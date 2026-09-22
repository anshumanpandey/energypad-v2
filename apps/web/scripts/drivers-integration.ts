import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { DriverService } from '../src/server/drivers';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mailer = { async send() {} };
const sites = new SiteService(db, mailer, 'http://localhost:3100');
const drivers = new DriverService(db, mailer, 'http://localhost:3100');
async function workbook(rows: (string | number)[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Drivers');
  sheet.addRow(['month', 'driver', 'value', 'source', 'password']);
  for (const row of rows) sheet.addRow([...row, 'discard-this-secret']);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { emailVerified: new Date(), email: 'drivers@example.test' } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { emailVerified: new Date(), email: 'other-drivers@example.test' } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Drivers', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, {
    code: 'A',
    name: 'Drivers',
    attributes: { effectiveFrom: '2020-01-01', population: '50', weeklyHours: '40' },
  });
  const empty = await drivers.list(actor, org.id, site.id, 2020);
  assert.equal(empty.coverage[0].missing.length, 12);
  assert.equal(empty.coverage[1].missing.length, 12);
  const input = { month: '2020-01', driver: 'POPULATION', value: '0', source: 'Synthetic attendance' };
  const zero = await drivers.add(actor, org.id, site.id, input);
  assert.equal(zero.value.toString(), '0');
  assert.equal((await drivers.list(actor, org.id, site.id, 2020)).coverage[0].missing.length, 11);
  await assert.rejects(drivers.add(actor, org.id, site.id, input));
  await assert.rejects(drivers.add(stranger, other.id, site.id, input));
  await assert.rejects(drivers.list(stranger, org.id, site.id, 2020));
  await assert.rejects(
    drivers.add(actor, org.id, site.id, { ...input, month: '2023-02', driver: 'OPERATING_HOURS', value: '673' }),
  );
  const concurrent = await Promise.allSettled([
    drivers.add(actor, org.id, site.id, { ...input, driver: 'OPERATING_HOURS' }),
    drivers.add(actor, org.id, site.id, { ...input, driver: 'OPERATING_HOURS' }),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
  console.log(
    '✓ zero observations, explicit monthly basis, calendar limits, gaps, tenant boundaries and concurrent duplicates',
  );
  const schedule = {
    name: 'Standard',
    firstDay: '2020-01-01',
    lastDay: '2020-06-30',
    weeklyHours: '40',
    source: 'Synthetic plan',
  };
  await drivers.addSchedule(actor, org.id, site.id, schedule);
  await assert.rejects(
    drivers.addSchedule(actor, org.id, site.id, { ...schedule, firstDay: '2020-06-30', lastDay: '2020-12-31' }),
  );
  await drivers.addSchedule(actor, org.id, site.id, {
    ...schedule,
    firstDay: '2020-07-01',
    lastDay: '2020-12-31',
    weeklyHours: '0',
  });
  assert.equal((await drivers.list(actor, org.id, site.id, 2020)).schedules.length, 2);
  assert.equal((await drivers.list(actor, org.id, site.id, 2021)).schedules.length, 0);
  assert.equal(await db.driverObservation.count(), 2);
  const competing = await Promise.allSettled([
    drivers.addSchedule(actor, org.id, site.id, { ...schedule, firstDay: '2022-01-01', lastDay: '2022-12-31' }),
    drivers.addSchedule(actor, org.id, site.id, { ...schedule, firstDay: '2022-06-01', lastDay: '2022-12-31' }),
  ]);
  assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1);
  console.log(
    '✓ inclusive schedule dates, adjacent ranges, concurrent overlap rejection and no fabricated observations',
  );
  const rows = Array.from({ length: 12 }, (_, i) => `2021-${String(i + 1).padStart(2, '0')}`).flatMap((month) => [
    [month, 'POPULATION', '12.5', 'Synthetic attendance'],
    [month, 'OPERATING_HOURS', '160', 'Synthetic log'],
  ]);
  const bytes = await workbook(rows);
  const batch = await drivers.upload(actor, org.id, site.id, bytes);
  assert.equal(batch.status, 'READY');
  assert.equal(JSON.stringify(batch).includes('discard-this-secret'), false);
  assert.equal((await drivers.upload(actor, org.id, site.id, bytes)).id, batch.id);
  await assert.rejects(drivers.commit(stranger, other.id, site.id, batch.id));
  await Promise.all([
    drivers.commit(actor, org.id, site.id, batch.id),
    drivers.commit(actor, org.id, site.id, batch.id),
  ]);
  const full = await drivers.list(actor, org.id, site.id, 2021);
  assert.equal(full.observations.length, 24);
  assert.ok(full.coverage.every((c) => c.missing.length === 0));
  assert.equal(await db.auditEvent.count({ where: { action: 'driver.import_committed', targetId: batch.id } }), 1);
  console.log('✓ 12 months / 24 rows, credential removal, atomic import and concurrent idempotency');
  const invalid = await drivers.upload(
    actor,
    org.id,
    site.id,
    await workbook([
      ['2023-01', 'POPULATION', '1', 'Test'],
      ['2023-01', 'POPULATION', '2', 'Test'],
    ]),
  );
  assert.equal(invalid.status, 'INVALID');
  await assert.rejects(drivers.commit(actor, org.id, site.id, invalid.id));
  const stale = await drivers.upload(
    actor,
    org.id,
    site.id,
    await workbook([
      ['2024-01', 'POPULATION', '1', 'Test'],
      ['2024-02', 'POPULATION', '2', 'Test'],
    ]),
  );
  await drivers.add(actor, org.id, site.id, { ...input, month: '2024-02' });
  await assert.rejects(drivers.commit(actor, org.id, site.id, stale.id));
  assert.equal((await drivers.list(actor, org.id, site.id, 2024)).observations.length, 1);
  assert.equal(await db.driverObservation.count({ where: { importBatchId: stale.id } }), 0);
  const manager = actorFor(
    (await db.user.create({ data: { emailVerified: new Date(), email: 'manager-driver@example.test' } })).id,
  );
  const membership = await db.membership.create({
    data: { organisationId: org.id, userId: manager.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(drivers.list(manager, org.id, site.id, 2021));
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: membership.id, siteId: site.id } });
  assert.equal((await drivers.list(manager, org.id, site.id, 2021)).observations.length, 24);
  await assert.rejects(drivers.add(manager, org.id, site.id, { ...input, month: '2025-01' }));
  await assert.rejects(
    drivers.addSchedule(manager, org.id, site.id, { ...schedule, firstDay: '2025-01-01', lastDay: '2025-12-31' }),
  );
  await assert.rejects(drivers.upload(manager, org.id, site.id, bytes));
  const delegated = actorFor(
    (await db.user.create({ data: { emailVerified: new Date(), email: 'admin-driver@example.test' } })).id,
  );
  const admin = await db.membership.create({
    data: { organisationId: org.id, userId: delegated.userId, role: 'ADMIN' },
  });
  const revoked = await drivers.upload(
    delegated,
    org.id,
    site.id,
    await workbook([['2025-01', 'POPULATION', '1', 'Test']]),
  );
  await db.membership.update({ where: { id: admin.id }, data: { role: 'VIEWER' } });
  await assert.rejects(drivers.commit(delegated, org.id, site.id, revoked.id));

  const correction = { observation: { ...input, value: '25' }, reason: 'Correct attendance total' };
  await assert.rejects(drivers.correctObservation(manager, org.id, site.id, zero.id, correction));
  await assert.rejects(drivers.history(stranger, other.id, site.id, zero.id, 'observations'));
  await assert.rejects(drivers.correctObservation(actor, org.id, site.id, zero.id, { ...correction, reason: '' }));
  await assert.rejects(
    drivers.correctObservation(actor, org.id, site.id, zero.id, {
      ...correction,
      observation: { ...correction.observation, month: '2020-02' },
    }),
  );
  const corrected = await drivers.correctObservation(actor, org.id, site.id, zero.id, correction);
  assert.equal(corrected.revision, 2);
  assert.equal(corrected.value.toString(), '25');
  assert.equal((await drivers.history(manager, org.id, site.id, corrected.id, 'observations')).length, 2);
  assert.equal((await drivers.list(actor, org.id, site.id, 2020)).coverage[0].missing.length, 11);
  await assert.rejects(drivers.correctObservation(actor, org.id, site.id, zero.id, correction));
  const races = await Promise.allSettled([
    drivers.correctObservation(actor, org.id, site.id, corrected.id, correction),
    drivers.correctObservation(actor, org.id, site.id, corrected.id, correction),
  ]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(db.driverObservation.update({ where: { id: zero.id }, data: { value: 99 } }));
  const imported = full.observations.find((r) => r.driver === 'POPULATION')!;
  const importCorrection = await drivers.correctObservation(actor, org.id, site.id, imported.id, {
    observation: { ...input, month: imported.month.toISOString().slice(0, 7), value: '0' },
    reason: 'Correct imported observation',
  });
  assert.equal(importCorrection.importBatchId, batch.id);
  await drivers.commit(actor, org.id, site.id, batch.id);
  assert.equal((await drivers.list(actor, org.id, site.id, 2021)).observations.length, 24);
  await assert.rejects(drivers.add(actor, org.id, site.id, { ...input, month: '2021-01' }));
  console.log(
    '✓ observation revision history, identity, zero, preserved import, current coverage, concurrent edits and scoped access',
  );
  const originalSchedule = (await drivers.list(actor, org.id, site.id, 2020)).schedules[0];
  const scheduleCorrection = {
    schedule: { ...schedule, lastDay: '2020-05-31', weeklyHours: '0' },
    reason: 'Correct planned closure dates',
  };
  await assert.rejects(drivers.correctSchedule(manager, org.id, site.id, originalSchedule.id, scheduleCorrection));
  await assert.rejects(
    drivers.correctSchedule(actor, org.id, site.id, originalSchedule.id, {
      ...scheduleCorrection,
      schedule: { ...schedule, lastDay: '2020-07-01' },
    }),
  );
  const revisedSchedule = await drivers.correctSchedule(
    actor,
    org.id,
    site.id,
    originalSchedule.id,
    scheduleCorrection,
  );
  assert.equal(revisedSchedule.weeklyHours.toString(), '0');
  assert.equal((await drivers.history(manager, org.id, site.id, revisedSchedule.id, 'schedules')).length, 2);
  await drivers.addSchedule(actor, org.id, site.id, { ...schedule, firstDay: '2020-06-01', lastDay: '2020-06-30' });
  assert.equal((await drivers.list(actor, org.id, site.id, 2020)).schedules.length, 3);
  await assert.rejects(drivers.correctSchedule(actor, org.id, site.id, originalSchedule.id, scheduleCorrection));
  const scheduleRaces = await Promise.allSettled([
    drivers.correctSchedule(actor, org.id, site.id, revisedSchedule.id, scheduleCorrection),
    drivers.correctSchedule(actor, org.id, site.id, revisedSchedule.id, scheduleCorrection),
  ]);
  assert.equal(scheduleRaces.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(db.operatingSchedule.delete({ where: { id: originalSchedule.id } }));
  assert.equal(await db.auditEvent.count({ where: { action: 'driver.schedule_corrected' } }), 2);
  console.log(
    '✓ schedule history, date replacement, released ranges, overlap rejection, stale/concurrent edits and immutability',
  );
  const namedBook = new ExcelJS.Workbook();
  namedBook.addWorksheet('Unselected').addRows([
    ['month', 'driver', 'value', 'source'],
    ['2030-01', 'POPULATION', '999', 'Must stay outside'],
  ]);
  namedBook.addWorksheet('Reviewed').addRows([
    ['Period', 'Count'],
    ['2030-01', '0'],
  ]);
  const namedTemplate = {
    version: 1,
    kind: 'drivers',
    sheetName: 'Reviewed',
    columns: { month: 'Period', value: 'Count' },
    defaults: { driver: 'POPULATION', source: 'Reviewed attendance' },
  };
  const namedBytes = new Uint8Array(await namedBook.xlsx.writeBuffer());
  await assert.rejects(drivers.upload(actor, org.id, site.id, namedBytes));
  const namedBatch = await drivers.upload(actor, org.id, site.id, namedBytes, undefined, namedTemplate);
  assert.equal(namedBatch.status, 'READY');
  assert.deepEqual((namedBatch.result as { selection: { excludedSheets: string[] } }).selection.excludedSheets, [
    'Unselected',
  ]);
  await drivers.commit(actor, org.id, site.id, namedBatch.id);
  assert.equal(await db.driverObservation.count({ where: { importBatchId: namedBatch.id } }), 1);
  namedBook.getWorksheet('Unselected')!.addRow(['Changed unrelated row']);
  const retry = await drivers.upload(
    actor,
    org.id,
    site.id,
    new Uint8Array(await namedBook.xlsx.writeBuffer()),
    undefined,
    namedTemplate,
  );
  assert.equal(retry.id, namedBatch.id);
  console.log('✓ named-sheet mapping, versioned template, excluded rows and retry after unrelated sheet changes');
  await sites.archiveSite(actor, org.id, site.id);
  await assert.rejects(drivers.correctObservation(actor, org.id, site.id, importCorrection.id, correction));
  await assert.rejects(drivers.correctSchedule(actor, org.id, site.id, revisedSchedule.id, scheduleCorrection));
  await assert.rejects(drivers.add(actor, org.id, site.id, { ...input, month: '2026-01' }));
  await assert.rejects(drivers.commit(actor, org.id, site.id, revoked.id));
  console.log('✓ invalid batches, stale-preview rollback, assigned-site reads, revoked writes and archive protection');
} finally {
  await cleanup();
}
