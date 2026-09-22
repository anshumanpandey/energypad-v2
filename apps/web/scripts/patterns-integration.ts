import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { SiteService } from '../src/server/sites';
import { TariffService } from '../src/server/tariffs';
import { PatternService } from '../src/server/patterns';
import { actorFor } from '../src/server/foundation';
const { db, cleanup } = await testDatabase();
const mail = {
  async send() {
    throw new Error('No mail');
  },
};
const sites = new SiteService(db, mail, 'http://localhost:3100'),
  uses = new TariffService(db, mail, 'http://localhost:3100'),
  service = new PatternService(db, mail, 'http://localhost:3100');
const input = {
  firstDay: '2020-01-01',
  lastDay: '2020-01-31',
  energyUseCode: 'OFFICE',
  daysOnYear: '0',
  temperature: null as string | null,
  temperatureUnit: 'UNKNOWN',
  temperatureContext: 'UNKNOWN',
  source: 'Attendance report',
  legacySource: 'reviewed-export',
  legacyId: 'tenant-01',
};
async function workbook(rows: (typeof input)[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Pattern');
  sheet.addRow(Object.keys(input));
  for (const row of rows) sheet.addRow(Object.values(row));
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'pattern@example.test', emailVerified: new Date() } })).id,
  );
  const outsider = actorFor(
    (await db.user.create({ data: { email: 'outsider@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(owner, { name: 'Pattern', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'A', name: 'Site A' });
  const other = await sites.createSite(owner, org.id, { code: 'B', name: 'Site B' });
  const use = await uses.addUse(owner, org.id, site.id, {
    code: 'OFFICE',
    name: 'Office',
    fuel: 'ELECTRICITY',
    source: 'Reviewed use',
  });
  await assert.rejects(service.add(owner, org.id, other.id, input));
  await assert.rejects(service.add(outsider, org.id, site.id, input));
  const first = await service.add(owner, org.id, site.id, input);
  assert.equal(first.daysOnYear, 0);
  assert.equal(first.temperature, null);
  await assert.rejects(service.add(owner, org.id, site.id, { ...input, legacyId: 'other' }));
  const correction = {
    observation: { ...input, daysOnYear: '15', temperature: '2' },
    reason: 'Corrected attendance',
  };
  const corrected = await service.correct(owner, org.id, site.id, first.id, correction);
  await assert.rejects(service.correct(owner, org.id, site.id, first.id, correction));

  assert.equal((await service.history(owner, org.id, site.id, first.id)).length, 2);
  assert.equal((await service.history(owner, org.id, site.id, first.id))[0].temperature?.toString(), '2');
  assert.equal((await service.list(owner, org.id, site.id, 2020))[0].daysOnYear, 15);
  await assert.rejects(db.operatingPattern.update({ where: { id: first.id }, data: { daysOnYear: 1 } }));
  await assert.rejects(db.operatingPattern.delete({ where: { id: first.id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE "OperatingPattern"'));
  await assert.rejects(db.operatingPattern.create({ data: { ...first, id: crypto.randomUUID(), siteId: other.id } }));
  console.log('✓ scoped end uses, denied writes, zero/unknown, overlap, correction lineage and immutable history');
  const rows = Array.from({ length: 24 }, (_, i) => ({
    ...input,
    firstDay: `2021-01-${String(i + 1).padStart(2, '0')}`,
    lastDay: `2021-01-${String(i + 1).padStart(2, '0')}`,
    legacyId: `daily-${i}`,
  }));
  const bytes = await workbook(rows);
  const batch = await service.upload(owner, org.id, site.id, bytes);
  assert.equal(batch.status, 'READY');
  assert.equal((batch.result as { sourceRows: number }).sourceRows, 24);
  assert.equal((await service.upload(owner, org.id, site.id, bytes)).id, batch.id);
  await Promise.all([
    service.commit(owner, org.id, site.id, batch.id),
    service.commit(owner, org.id, site.id, batch.id),
  ]);
  assert.equal(await db.operatingPattern.count({ where: { importBatchId: batch.id } }), 24);
  assert.equal(await db.auditEvent.count({ where: { action: 'pattern.import_committed', targetId: batch.id } }), 1);
  const imported = await db.operatingPattern.findFirstOrThrow({
    where: { importBatchId: batch.id },
    orderBy: { validFrom: 'asc' },
  });
  await service.correct(owner, org.id, site.id, imported.id, {
    observation: { ...rows[0], daysOnYear: '3' },
    reason: 'Reviewed count',
  });
  await service.commit(owner, org.id, site.id, batch.id);
  assert.equal((await service.history(owner, org.id, site.id, imported.id))[0].daysOnYear, 3);
  const later = rows
    .slice(0, 2)
    .map((r, i) => ({ ...r, firstDay: `2022-01-0${i + 1}`, lastDay: `2022-01-0${i + 1}`, legacyId: `later-${i}` }));
  const stale = await service.upload(owner, org.id, site.id, await workbook(later));
  await service.add(owner, org.id, site.id, later[1]);
  const before = await db.auditEvent.count();
  await assert.rejects(service.commit(owner, org.id, site.id, stale.id));
  assert.equal(await db.operatingPattern.count({ where: { importBatchId: stale.id } }), 0);
  assert.equal(await db.auditEvent.count(), before);
  assert.equal((await service.upload(owner, org.id, site.id, await workbook([rows[0], rows[0]]))).status, 'INVALID');
  assert.equal(await db.driverObservation.count(), 0);
  const manager = actorFor(
    (await db.user.create({ data: { email: 'manager@example.test', emailVerified: new Date() } })).id,
  );
  const membership = await db.membership.create({
    data: { userId: manager.userId, organisationId: org.id, role: 'SITE_MANAGER' },
  });
  await assert.rejects(service.list(manager, org.id, site.id, 2020));
  await db.siteAssignment.create({ data: { membershipId: membership.id, organisationId: org.id, siteId: site.id } });
  assert.equal((await service.list(manager, org.id, site.id, 2020)).length, 1);
  await assert.rejects(service.add(manager, org.id, site.id, input));
  const moved = await service.correct(owner, org.id, site.id, corrected.id, {
    observation: {
      ...input,
      firstDay: '2019-12-01',
      daysOnYear: '366',
      temperature: '-5.125',
      temperatureUnit: 'C',
      temperatureContext: 'HEATING',
    },
    reason: 'Review validity and setpoint',
  });
  assert.equal((await service.history(owner, org.id, site.id, first.id)).length, 3);
  assert.equal(moved.temperature?.toString(), '-5.125');
  assert.equal((await service.list(owner, org.id, site.id, 2019)).length, 1);
  assert.ok((await service.list(owner, org.id, site.id, 2019))[0].warnings.length);
  assert.equal(await db.weatherConfiguration.count(), 0);
  assert.equal(await db.operatingSchedule.count(), 0);
  const namedBook = new ExcelJS.Workbook();
  namedBook.addWorksheet('Unselected').addRows([['anything'], ['Not a pattern']]);
  namedBook.addWorksheet('Reviewed').addRows([['Setpoint'], ['0']]);
  const namedTemplate = {
    version: 1,
    kind: 'patterns',
    sheetName: 'Reviewed',
    columns: { temperature: 'Setpoint' },
    defaults: {
      firstDay: '2030-01-01',
      lastDay: '2030-12-31',
      energyUseCode: 'OFFICE',
      daysOnYear: '0',
      temperatureUnit: 'C',
      temperatureContext: 'HEATING',
      source: 'Reviewed setpoint',
    },
  };
  const namedBytes = new Uint8Array(await namedBook.xlsx.writeBuffer());
  await assert.rejects(service.upload(owner, org.id, site.id, namedBytes));
  const namedBatch = await service.upload(owner, org.id, site.id, namedBytes, undefined, namedTemplate);
  assert.equal(namedBatch.status, 'READY');
  assert.deepEqual((namedBatch.result as { selection: { excludedSheets: string[] } }).selection.excludedSheets, [
    'Unselected',
  ]);
  await service.commit(owner, org.id, site.id, namedBatch.id);
  assert.equal(await db.operatingPattern.count({ where: { importBatchId: namedBatch.id } }), 1);
  namedBook.getWorksheet('Unselected')!.addRow(['Changed unrelated row']);
  const retry = await service.upload(
    owner,
    org.id,
    site.id,
    new Uint8Array(await namedBook.xlsx.writeBuffer()),
    undefined,
    namedTemplate,
  );
  assert.equal(retry.id, namedBatch.id);
  console.log('✓ named-sheet mapping, versioned template, excluded rows and retry after unrelated sheet changes');
  await db.site.update({ where: { id: site.id }, data: { archivedAt: new Date() } });
  await assert.rejects(service.commit(owner, org.id, site.id, batch.id));
  assert.ok(use.id);
  console.log(
    '✓ 24-row reconciliation, idempotent concurrent commit, preserved imported correction, stale batch rollback, assigned-site reads and archive protection',
  );
} finally {
  await cleanup();
}
