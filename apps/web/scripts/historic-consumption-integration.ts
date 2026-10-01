import { SiteService } from '../src/server/sites';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { HistoricConsumptionService } from '../src/server/historic-consumption';
import { historicColumns, historicSheet, historicCompactColumns } from '../src/domain/historic-consumption';
import { WorkbookCellError } from '../src/domain/workbook-errors';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const siteService = new SiteService(db, { async send() {} }, 'http://localhost:3100');
const service = new HistoricConsumptionService(db, { async send() {} }, 'http://localhost:3100');
async function workbook(rows: unknown[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(historicSheet);
  sheet.addRow(historicColumns);
  rows.forEach((r) => sheet.addRow(r));
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const row = (code: string, month = 'Jan') => [
  code,
  2020,
  month,
  'Heating',
  'Gas',
  '',
  45,
  'kWh',
  600,
  { formula: 'I2/10', result: 60 },
  1,
  120,
  9,
];
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'historic@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'stranger@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(actor, { name: 'Historic import', currency: 'GBP', timezone: 'UTC' });
  const sites = [];
  for (const code of ['London', 'Leeds']) {
    const site = await siteService.createSite(actor, org.id, { code, name: code });
    sites.push(site);
    await siteService.saveMeter(actor, org.id, site.id, { code: 'Gas', name: 'Gas meter', fuel: 'GAS', unit: 'kWh' });
  }
  const ignored: unknown[] = row('London');
  ignored[5] = { error: '#VALUE!' };
  const bytes = await workbook([ignored, row('Leeds')]);
  await assert.rejects(service.process(stranger, org.id, bytes));
  const preview = await service.process(actor, org.id, bytes);
  assert.equal(preview.count, 2);
  assert.equal(await db.consumptionRecord.count(), 0);
  await assert.rejects(service.process(actor, org.id, bytes, 'bad'), /changed/);
  const bad = row('Leeds');
  bad[6] = 'bad';
  bad[12] = 25;
  await assert.rejects(
    service.process(actor, org.id, await workbook([row('London'), bad])),
    (e) =>
      e instanceof WorkbookCellError &&
      e.cellErrors.some((i) => i.cell === 'G3') &&
      e.cellErrors.some((i) => i.cell === 'M3'),
  );
  assert.equal(await db.consumptionRecord.count(), 0);
  const result = await service.process(actor, org.id, bytes, preview.signature);
  assert.equal(result.committed, true);
  const records = await db.consumptionRecord.findMany();
  assert.equal(records.length, 2);
  assert.equal(records[0].netCost?.toString(), '540');
  assert.equal(records[0].vatCost?.toString(), '60');
  assert.equal(records[0].grossCost?.toString(), '600');
  assert.equal((records[0].sourceProvenance as { operatingHoursBasis: string }).operatingHoursBasis, 'HOURS_PER_DAY');
  await service.process(actor, org.id, bytes, preview.signature);
  assert.equal(await db.consumptionRecord.count(), 2);
  await assert.rejects(
    service.process(actor, org.id, await workbook([row('London', 'Feb'), row('London', 'Feb')])),
    /Duplicate/,
  );
  const mismatch = row('London', 'Feb');
  mismatch[10] = 2;
  await assert.rejects(service.process(actor, org.id, await workbook([mismatch])), /Expected 1/);
  await siteService.saveMeter(actor, org.id, sites[0].id, {
    code: 'Gas2',
    name: 'Second gas',
    fuel: 'GAS',
    unit: 'kWh',
  });
  await assert.rejects(
    service.process(actor, org.id, await workbook([row('London', 'Feb')])),
    /Multiple active meters/,
  );
  const explicit = row('London', 'Feb');
  explicit[5] = 'Gas';
  await assert.rejects(service.process(actor, org.id, await workbook([explicit])), /Multiple active meters/);
  const grid = await siteService.saveMeter(actor, org.id, sites[0].id, {
    code: 'GRID',
    name: 'Grid electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const solarRow = row('London', 'Mar');
  solarRow[4] = 'Solar PV';
  const solarProposal = await service.process(actor, org.id, await workbook([solarRow]));
  assert.equal(solarProposal.defaultMeters.length, 1);
  const solar = await siteService.saveMeter(actor, org.id, sites[0].id, {
    code: 'PV',
    name: 'Solar PV',
    fuel: 'SOLAR_PV',
    unit: 'kWh',
  });
  await assert.rejects(service.process(actor, org.id, await workbook([solarRow]), solarProposal.signature), /changed/);
  const gridRow = row('London', 'Mar');
  gridRow[4] = 'Grid Electricity';
  const solarBytes = await workbook([solarRow, gridRow]);
  const solarPreview = await service.process(actor, org.id, solarBytes);
  assert.equal(solarPreview.count, 2);
  await service.process(actor, org.id, solarBytes, solarPreview.signature);
  assert.equal((await db.consumptionRecord.findFirstOrThrow({ where: { meterId: solar.id } })).fuel, 'SOLAR_PV');
  assert.equal((await db.consumptionRecord.findFirstOrThrow({ where: { meterId: grid.id } })).fuel, 'ELECTRICITY');
  const petrolRow = row('London', 'May');
  petrolRow[4] = 'Petrol';
  const petrolBytes = await workbook([petrolRow]);
  const petrolPreview = await service.process(actor, org.id, petrolBytes);
  assert.equal(petrolPreview.defaultMeters[0].fuel, 'PETROL');
  await service.process(actor, org.id, petrolBytes, petrolPreview.signature);
  const petrolMeter = await db.meter.findFirstOrThrow({ where: { siteId: sites[0].id, fuel: 'PETROL' } });
  assert.equal((await db.consumptionRecord.findFirstOrThrow({ where: { meterId: petrolMeter.id } })).fuel, 'PETROL');
  const compactBook = new ExcelJS.Workbook();
  const compactSheet = compactBook.addWorksheet(historicSheet);
  compactSheet.addRow(historicCompactColumns);
  compactSheet.addRow(row('Leeds', 'Apr').filter((_, i) => i !== 5));
  const compactBytes = new Uint8Array(await compactBook.xlsx.writeBuffer());
  const compactPreview = await service.process(actor, org.id, compactBytes);
  assert.equal(compactPreview.count, 1);
  assert.equal(compactPreview.records[0].quantity, '45');
  assert.equal(compactPreview.records[0].grossCost, '600');
  await service.process(actor, org.id, compactBytes, compactPreview.signature);
  assert.equal((await service.process(actor, org.id, compactBytes)).committed, true);
  compactSheet.getCell('J2').value = 2;
  compactSheet.getCell('C2').value = 'May';
  await assert.rejects(
    service.process(actor, org.id, new Uint8Array(await compactBook.xlsx.writeBuffer())),
    (e) =>
      e instanceof WorkbookCellError && e.cellErrors.some((i) => i.cell === 'J2' && i.message.includes('Expected 1')),
  );
  const autoSite = await siteService.createSite(actor, org.id, { code: 'AUTO', name: 'Auto meter site' });
  const autoRows = [row('AUTO'), row('AUTO', 'Feb')];
  const autoBytes = await workbook(autoRows);
  const beforeAudit = await db.auditEvent.count();
  const autoPreview = await service.process(actor, org.id, autoBytes);
  assert.equal(autoPreview.defaultMeters.length, 1);
  assert.equal(await db.meter.count({ where: { siteId: autoSite.id } }), 0);
  assert.equal(await db.auditEvent.count(), beforeAudit);
  assert.equal((await service.process(actor, org.id, autoBytes)).signature, autoPreview.signature);
  await assert.rejects(service.process(actor, org.id, autoBytes, 'stale'), /changed/);
  assert.equal(await db.meter.count({ where: { siteId: autoSite.id } }), 0);
  await Promise.all([
    service.process(actor, org.id, autoBytes, autoPreview.signature),
    service.process(actor, org.id, autoBytes, autoPreview.signature),
  ]);
  assert.equal(await db.meter.count({ where: { siteId: autoSite.id } }), 1);
  assert.equal(await db.consumptionRecord.count({ where: { siteId: autoSite.id } }), 2);
  const oil = row('AUTO', 'Mar');
  oil[4] = 'Diesel';
  oil[7] = 'l';
  oil[10] = 2;
  const oilBytes = await workbook([oil]);
  const oilPreview = await service.process(actor, org.id, oilBytes);
  assert.equal(oilPreview.defaultMeters.length, 1);
  assert.equal(await db.unitConversionVersion.count({ where: { siteId: autoSite.id } }), 0);
  await service.process(actor, org.id, oilBytes, oilPreview.signature);
  const oilRecord = await db.consumptionRecord.findFirstOrThrow({ where: { siteId: autoSite.id, fuel: 'OIL' } });
  assert.equal(oilRecord.normalizedKwh.toString(), '90');
  assert.ok(oilRecord.conversionId);
  const invalidSolar = row('AUTO', 'Mar');
  invalidSolar[4] = 'Solar PV';
  invalidSolar[6] = 'bad';
  const validSolar = row('AUTO', 'Apr');
  validSolar[4] = 'Solar PV';
  await assert.rejects(service.process(actor, org.id, await workbook([validSolar, invalidSolar])));
  assert.equal(await db.meter.count({ where: { siteId: autoSite.id } }), 2);
  console.log(
    'Historic consumption integration passed: costs, source hours, isolation, atomicity, stale previews, duplicates, factors and ambiguous meters.',
  );
} finally {
  await cleanup();
}
