import { SiteService } from '../src/server/sites';
import { UtilityGraphService } from '../src/server/utility-graphs';
import { readFile } from 'node:fs/promises';
import { HistoricEmissionsService } from '../src/server/historic-emissions';
import { TargetImportService } from '../src/server/target-import';
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
  // Re-imports update current revisions atomically, including mixed new and unchanged rows.
  const updateOrg = await service.createOrganisation(actor, {
    name: 'Import updates',
    currency: 'GBP',
    timezone: 'UTC',
  });
  const updateSite = await siteService.createSite(actor, updateOrg.id, { code: 'UPDATE', name: 'Update site' });
  const initialBytes = await workbook([row('UPDATE')]);
  const initialPreview = await service.process(actor, updateOrg.id, initialBytes);
  await service.process(actor, updateOrg.id, initialBytes, initialPreview.signature);
  const original = await db.consumptionRecord.findFirstOrThrow({ where: { siteId: updateSite.id } });
  const changedRow = row('UPDATE');
  changedRow[6] = 90;
  changedRow[8] = 900;
  changedRow[9] = 90;
  changedRow[11] = 150;
  changedRow[12] = 8;
  const changedBytes = await workbook([changedRow, row('UPDATE', 'Feb')]);
  const updatePreview = await service.process(actor, updateOrg.id, changedBytes);
  assert.equal(updatePreview.updated, 1);
  assert.equal(updatePreview.created, 1);
  assert.equal(updatePreview.records[0].previousQuantity, '45');
  assert.equal(await db.consumptionRecord.count({ where: { siteId: updateSite.id } }), 1);
  const invalidUpdate = [...changedRow];
  invalidUpdate[12] = 30;
  await assert.rejects(service.process(actor, updateOrg.id, await workbook([changedRow, invalidUpdate])));
  assert.equal(await db.consumptionRecord.count({ where: { siteId: updateSite.id } }), 1);
  await Promise.all([
    service.process(actor, updateOrg.id, changedBytes, updatePreview.signature),
    service.process(actor, updateOrg.id, changedBytes, updatePreview.signature),
  ]);
  const currentReading = await db.consumptionRecord.findFirstOrThrow({
    where: { siteId: updateSite.id, periodStart: original.periodStart, replacement: { is: null } },
  });
  assert.deepEqual(currentReading.sourceProvenance, original.sourceProvenance);
  assert.equal(currentReading.revision, 2);
  assert.equal(currentReading.supersedesId, original.id);
  assert.equal(currentReading.sourceQuantity.toString(), '90');
  assert.equal(currentReading.normalizedKwh.toString(), '90');
  assert.equal(currentReading.netCost?.toString(), '810');
  assert.equal(currentReading.grossCost?.toString(), '900');
  assert.equal((currentReading.importProvenance as { population: string }).population, '150');
  assert.equal(
    (await db.consumptionRecord.findUniqueOrThrow({ where: { id: original.id } })).sourceQuantity.toString(),
    '45',
  );
  assert.equal(await db.consumptionRecord.count({ where: { siteId: updateSite.id } }), 3);
  assert.equal(await db.consumptionRecord.count({ where: { siteId: updateSite.id, replacement: { is: null } } }), 2);
  assert.equal(await db.auditEvent.count({ where: { organisationId: updateOrg.id, action: 'energy.corrected' } }), 1);
  const unchanged = await service.process(actor, updateOrg.id, changedBytes);
  assert.equal(unchanged.unchanged, 2);
  assert.equal(unchanged.committed, true);
  // An old workbook may be explicitly restored after preview; an old commit token cannot silently restore it.
  await assert.rejects(service.process(actor, updateOrg.id, initialBytes, initialPreview.signature), /changed/);
  const restore = await service.process(actor, updateOrg.id, initialBytes);
  assert.equal(restore.updated, 1);
  const newerRow = [...changedRow];
  newerRow[6] = 100;
  const newerBytes = await workbook([newerRow]);
  const newer = await service.process(actor, updateOrg.id, newerBytes);
  await service.process(actor, updateOrg.id, newerBytes, newer.signature);
  await assert.rejects(service.process(actor, updateOrg.id, initialBytes, restore.signature), /changed/);
  const freshRestore = await service.process(actor, updateOrg.id, initialBytes);
  await service.process(actor, updateOrg.id, initialBytes, freshRestore.signature);
  const mixed = await service.process(actor, updateOrg.id, changedBytes);
  assert.equal(mixed.updated, 1);
  assert.equal(mixed.unchanged, 1);
  await service.process(actor, updateOrg.id, changedBytes, mixed.signature);
  assert.equal(await db.consumptionRecord.count({ where: { siteId: updateSite.id, replacement: { is: null } } }), 2);
  // Exercise the actual latest public workbook through preview, commit and re-import.
  const latestOrg = await service.createOrganisation(actor, {
    name: 'Latest template',
    currency: 'GBP',
    timezone: 'UTC',
  });
  for (const name of ['London', 'Manchester', 'Leeds', 'Glasgow'])
    await siteService.createSite(actor, latestOrg.id, { code: name, name });
  const latestBytes = new Uint8Array(await readFile('public/templates/consumption-latest.xlsx'));
  const latestPreview = await service.process(actor, latestOrg.id, latestBytes);
  assert.equal(latestPreview.count, 192);
  assert.equal(latestPreview.defaultMeters.length, 12);
  await service.process(actor, latestOrg.id, latestBytes, latestPreview.signature);
  assert.equal(await db.consumptionRecord.count({ where: { organisationId: latestOrg.id } }), 192);
  const repeated = await service.process(actor, latestOrg.id, latestBytes);
  assert.equal(repeated.unchanged, 192);
  assert.equal(repeated.defaultMeters.length, 0);
  const emissions = new HistoricEmissionsService(db, { async send() {} }, 'http://localhost:3100');
  const factors = await emissions.process(actor, latestOrg.id, latestBytes, {
    geography: 'GB',
    basis: 'LOCATION_BASED',
  });
  assert.equal(factors.count, 96);
  await emissions.process(
    actor,
    latestOrg.id,
    latestBytes,
    { geography: 'GB', basis: 'LOCATION_BASED' },
    factors.signature,
  );
  const targets = new TargetImportService(db, { async send() {} }, 'http://localhost:3100');
  const targetPreview = await targets.process(actor, latestOrg.id, latestBytes);
  assert.equal(targetPreview.count, 96);
  await targets.process(actor, latestOrg.id, latestBytes, targetPreview.signature);
  assert.equal(await db.monthlyPlanVersion.count({ where: { organisationId: latestOrg.id, fuel: 'ALL' } }), 96);
  const graphs = new UtilityGraphService(db, { async send() {} }, 'http://localhost:3100');
  const graphRows = await graphs.records(actor, latestOrg.id);
  assert.equal(graphRows.length, 96);
  assert.equal(new Set(graphRows.map((r) => r.siteId)).size, 4);
  assert.deepEqual([...new Set(graphRows.map((r) => r.month.slice(0, 4)))].sort(), ['2025', '2026']);
  assert.ok(graphRows.every((r) => r.consumption !== null && r.emissions !== null));
  const londonJanuary = graphRows.find((r) => r.siteName === 'London' && r.month === '2025-01')!;
  const londonReadings = await db.consumptionRecord.findMany({
    where: { siteId: londonJanuary.siteId, periodStart: new Date('2025-01-01') },
  });
  assert.equal(
    Number(londonJanuary.consumption),
    londonReadings.reduce((total, r) => total + Number(r.normalizedKwh), 0),
  );
  const januaryFactor = await db.emissionFactorVersion.findFirstOrThrow({
    where: { siteId: londonJanuary.siteId, validFrom: new Date('2025-01-01') },
  });
  assert.equal(Number(londonJanuary.emissions), Number(londonJanuary.consumption) * Number(januaryFactor.factor));
  await assert.rejects(() => graphs.records(stranger, latestOrg.id));
  const graphManager = await db.membership.create({
    data: { organisationId: latestOrg.id, userId: stranger.userId, role: 'SITE_MANAGER' },
  });
  assert.deepEqual(await graphs.records(stranger, latestOrg.id), []);
  await db.siteAssignment.create({
    data: { organisationId: latestOrg.id, membershipId: graphManager.id, siteId: londonJanuary.siteId },
  });
  assert.ok((await graphs.records(stranger, latestOrg.id)).every((r) => r.siteId === londonJanuary.siteId));
  const gapOrg = await service.createOrganisation(actor, {
    name: 'Confirmed missing months',
    currency: 'GBP',
    timezone: 'UTC',
  });
  await siteService.createSite(actor, gapOrg.id, { code: 'London', name: 'London' });
  const gapBytes = await workbook([row('London')]);
  const warned = await service.process(actor, gapOrg.id, gapBytes);
  assert.equal(warned.count, 1);
  assert.equal(warned.missingMonths.length, 11);
  assert.equal(await db.consumptionRecord.count({ where: { organisationId: gapOrg.id } }), 0);
  await assert.rejects(service.process(actor, gapOrg.id, gapBytes, warned.signature, true), /changed/);
  const confirmed = await service.process(actor, gapOrg.id, gapBytes, undefined, true);
  assert.equal(confirmed.count, 12);
  assert.equal(await db.consumptionRecord.count({ where: { organisationId: gapOrg.id } }), 0);
  await service.process(actor, gapOrg.id, gapBytes, confirmed.signature, true);
  const filled = await db.consumptionRecord.findMany({ where: { organisationId: gapOrg.id } });
  assert.equal(filled.filter((r) => r.sourceQuantity.isZero()).length, 11);
  assert.ok(
    filled
      .filter((r) => r.sourceQuantity.isZero())
      .every(
        (r) =>
          Array.isArray(r.qualityFlags) && r.qualityFlags.includes('Missing month filled with 0 after confirmation'),
      ),
  );
  const february = filled.find((r) => r.periodStart.getUTCMonth() === 1)!;
  await service.correctReading(actor, gapOrg.id, february.siteId, february.id, {
    reading: { meterId: february.meterId, month: '2020-02', quantity: '17' },
    reason: 'Actual reading received after zero fill',
    useLatestConversion: false,
  });
  const shortened = await service.process(actor, gapOrg.id, gapBytes, undefined, true);
  assert.equal(shortened.records.filter((r) => r.quantity === '0').length, 0);
  assert.equal(
    (
      await db.consumptionRecord.findFirstOrThrow({
        where: { organisationId: gapOrg.id, periodStart: february.periodStart, replacement: { is: null } },
      })
    ).sourceQuantity.toString(),
    '17',
  );
  const gapFactorsBook = new ExcelJS.Workbook();
  const factorSheet = gapFactorsBook.addWorksheet('Emissions');
  factorSheet.addRow(['Site Name', 'Year', 'Month', 'Emission Factor']);
  factorSheet.addRow(['London', '2020', 'Jan', '0.4']);
  const gapTargetsSheet = gapFactorsBook.addWorksheet('Targets');
  gapTargetsSheet.addRow(['Site Code', 'Year', 'Month', 'Target Energy', 'Target Carbon (Kg)']);
  gapTargetsSheet.addRow(['London', '2020', 'Jan', '90', '90']);
  const gapPlanBytes = new Uint8Array(await gapFactorsBook.xlsx.writeBuffer());
  const settings = { geography: 'GB', basis: 'LOCATION_BASED' };
  const warnedFactors = await emissions.process(actor, gapOrg.id, gapPlanBytes, settings);
  assert.equal(warnedFactors.missingMonths.length, 11);
  assert.equal(warnedFactors.count, 1);
  await assert.rejects(
    emissions.process(actor, gapOrg.id, gapPlanBytes, settings, warnedFactors.signature, true),
    /changed/,
  );
  const confirmedFactors = await emissions.process(actor, gapOrg.id, gapPlanBytes, settings, undefined, true);
  await emissions.process(actor, gapOrg.id, gapPlanBytes, settings, confirmedFactors.signature, true);
  assert.equal(await db.emissionFactorVersion.count({ where: { organisationId: gapOrg.id, factor: 0 } }), 11);
  const warnedTargets = await targets.process(actor, gapOrg.id, gapPlanBytes);
  assert.equal(warnedTargets.count, 1);
  assert.equal(warnedTargets.missingMonths.length, 11);
  await assert.rejects(targets.process(actor, gapOrg.id, gapPlanBytes, warnedTargets.signature, true), /changed/);
  const confirmedTargets = await targets.process(actor, gapOrg.id, gapPlanBytes, undefined, true);
  await targets.process(actor, gapOrg.id, gapPlanBytes, confirmedTargets.signature, true);
  assert.equal(await db.monthlyPlanVersion.count({ where: { organisationId: gapOrg.id } }), 12);
  const gapGraph = await graphs.records(actor, gapOrg.id);
  assert.equal(gapGraph.find((r) => r.month === '2020-03')!.consumption, '0');
  assert.equal(gapGraph.find((r) => r.month === '2020-03')!.zeroFilled, true);
  assert.equal(gapGraph.find((r) => r.month === '2020-02')!.consumption, '17');
  console.log(
    'Historic consumption integration passed: costs, source hours, isolation, atomicity, stale previews, duplicates, factors and ambiguous meters.',
  );
} finally {
  await cleanup();
}
