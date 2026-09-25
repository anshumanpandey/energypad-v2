import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyImportService } from '../src/server/energy-import';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mailer = { async send() {} };
const sites = new SiteService(db, mailer, 'http://localhost:3100');
const energy = new EnergyImportService(db, mailer, 'http://localhost:3100');
async function workbook(months: string[], badUnit = false) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Readings');
  sheet.addRow(['month', 'quantity', 'unit', 'password']);
  for (const month of months) {
    const row = sheet.addRow([
      new Date(`${month}-01T00:00:00Z`),
      { formula: '50*2', result: 100 },
      badUnit ? 'm3' : 'kWh',
      'synthetic-secret',
    ]);
    row.getCell(1).numFmt = 'mmm-yy';
    row.getCell(2).numFmt = '#,##0.00';
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const mapping = {
  sheet: 0,
  columns: { month: 0, quantity: 1, unit: 2 },
  defaults: { estimated: 'actual', netCost: '15', currency: 'GBP', vatPercent: '20' },
  confirmed: true,
};
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'import-owner@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'import-other@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Import Energy', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other Import', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'IMPORT', name: 'Import site' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E1',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const bytes = await workbook(Array.from({ length: 12 }, (_, i) => `2020-${String(i + 1).padStart(2, '0')}`));
  const batch = await energy.upload(actor, org.id, site.id, meter.id, bytes);
  assert.ok(!JSON.stringify(batch).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(batch.sheets).includes('password'));
  assert.equal((await energy.upload(actor, org.id, site.id, meter.id, bytes)).id, batch.id);
  assert.equal((await energy.map(actor, org.id, site.id, batch.id, mapping)).status, 'READY');
  const commits = await Promise.all([
    energy.commit(actor, org.id, site.id, batch.id),
    energy.commit(actor, org.id, site.id, batch.id),
  ]);
  assert.ok(commits.every((b) => b.status === 'COMMITTED'));
  assert.equal(await db.consumptionRecord.count({ where: { energyImportId: batch.id } }), 12);
  assert.equal(await db.auditEvent.count({ where: { targetId: batch.id, action: 'energy.import_committed' } }), 1);
  const records = await energy.records(actor, org.id, site.id, 2020);
  assert.equal(records.coverage[0].missing.length, 0);
  assert.equal(
    records.records.reduce((sum, r) => sum + Number(r.normalizedKwh), 0),
    1200,
  );
  assert.equal(records.records[0].grossCost?.toString(), '18');
  console.log('✓ 12-month atomic import, credential stripping, repeated upload and concurrent commit');
  await assert.rejects(energy.detail(stranger, org.id, site.id, batch.id));
  await assert.rejects(energy.commit(stranger, other.id, site.id, batch.id));
  const invalid = await energy.upload(actor, org.id, site.id, meter.id, await workbook(['2021-01', '2021-01'], true));
  assert.equal((await energy.map(actor, org.id, site.id, invalid.id, mapping)).status, 'INVALID');
  await assert.rejects(energy.commit(actor, org.id, site.id, invalid.id));
  assert.equal(await db.consumptionRecord.count({ where: { energyImportId: invalid.id } }), 0);
  console.log('✓ tenant boundaries and invalid unit/duplicate rows cannot commit');
  const stale = await energy.upload(actor, org.id, site.id, meter.id, await workbook(['2022-01', '2022-02']));
  await energy.map(actor, org.id, site.id, stale.id, mapping);
  await energy.add(actor, org.id, site.id, { meterId: meter.id, month: '2022-02', quantity: '1' });
  await assert.rejects(energy.commit(actor, org.id, site.id, stale.id));
  assert.equal(await db.consumptionRecord.count({ where: { energyImportId: stale.id } }), 0);
  const context = await energy.upload(actor, org.id, site.id, meter.id, await workbook(['2023-01']));
  await energy.map(actor, org.id, site.id, context.id, mapping);
  await sites.addAttributes(actor, org.id, site.id, { effectiveFrom: '2023-01-01', population: '25' });
  await assert.rejects(energy.commit(actor, org.id, site.id, context.id));
  await energy.map(actor, org.id, site.id, context.id, mapping);
  await energy.commit(actor, org.id, site.id, context.id);
  console.log('✓ stale overlaps and changed historical context fail atomically; revalidation succeeds');
  const revoked = await energy.upload(actor, org.id, site.id, meter.id, await workbook(['2025-01']));
  await energy.map(actor, org.id, site.id, revoked.id, mapping);
  await db.membership.updateMany({ where: { organisationId: org.id, userId: actor.userId }, data: { role: 'VIEWER' } });
  await assert.rejects(energy.commit(actor, org.id, site.id, revoked.id));
  console.log('✓ revoked write access is rechecked before commit');
} finally {
  await cleanup();
}
