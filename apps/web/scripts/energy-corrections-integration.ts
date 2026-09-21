import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { EnergyImportService } from '../src/server/energy-import';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} };
const sites = new SiteService(db, mail, 'http://localhost:3100');
const energy = new EnergyService(db, mail, 'http://localhost:3100');
const imports = new EnergyImportService(db, mail, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'corrections@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other-corrections@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Corrections', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, {
    code: 'C',
    name: 'Correction site',
    attributes: { effectiveFrom: '2020-01-01', population: '10', weeklyHours: '40', floorArea: '100' },
  });
  const meter = await sites.saveMeter(actor, org.id, site.id, { code: 'G', name: 'Gas', fuel: 'GAS', unit: 'm3' });
  const factorInput = {
    meterId: meter.id,
    firstMonth: '2020-01',
    lastMonth: '2020-12',
    factor: '10',
    source: 'Synthetic original factor',
  };
  const originalFactor = await energy.addConversion(actor, org.id, site.id, factorInput);
  const reading = {
    meterId: meter.id,
    month: '2020-01',
    quantity: '100',
    estimated: true,
    netCost: '100',
    vatPercent: '20',
    currency: 'GBP',
    endUse: 'Heating',
    externalLegacyId: 'legacy-test',
  };
  const original = await energy.add(actor, org.id, site.id, reading);
  await sites.addAttributes(actor, org.id, site.id, {
    effectiveFrom: '2020-01-15',
    population: '99',
    weeklyHours: '80',
  });
  const correction = {
    reading: { ...reading, quantity: '0', netCost: '0', estimated: false },
    reason: 'Correct supplier reading',
    useLatestConversion: false,
  };
  await assert.rejects(energy.correctReading(stranger, other.id, site.id, original.id, correction));
  await assert.rejects(energy.readingHistory(stranger, org.id, site.id, original.id));
  await assert.rejects(energy.correctReading(actor, org.id, site.id, original.id, { ...correction, reason: '' }));
  await assert.rejects(
    energy.correctReading(actor, org.id, site.id, original.id, {
      ...correction,
      reading: { ...correction.reading, month: '2020-02' },
    }),
  );
  const revised = await energy.correctReading(actor, org.id, site.id, original.id, correction);
  assert.equal(revised.revision, 2);
  assert.equal(revised.supersedesId, original.id);
  assert.equal(revised.normalizedKwh.toString(), '0');
  assert.equal(revised.grossCost?.toString(), '0');
  assert.deepEqual(revised.attributeSnapshot, original.attributeSnapshot);
  assert.ok(!(revised.qualityFlags as string[]).includes('Estimated reading'));
  assert.deepEqual(await db.consumptionRecord.findUniqueOrThrow({ where: { id: original.id } }), original);
  const current = await energy.records(actor, org.id, site.id, 2020);
  assert.equal(current.records.length, 1);
  assert.equal(current.records[0].id, revised.id);
  assert.equal(current.coverage[0].missing.length, 11);
  assert.equal((await energy.readingHistory(actor, org.id, site.id, original.id)).length, 2);
  await assert.rejects(energy.correctReading(actor, org.id, site.id, original.id, correction));
  await assert.rejects(db.consumptionRecord.update({ where: { id: original.id }, data: { sourceQuantity: '999' } }));
  await assert.rejects(db.consumptionRecord.delete({ where: { id: original.id } }));
  const concurrently = await Promise.allSettled([
    energy.correctReading(actor, org.id, site.id, revised.id, correction),
    energy.correctReading(actor, org.id, site.id, revised.id, correction),
  ]);
  assert.equal(concurrently.filter((r) => r.status === 'fulfilled').length, 1);
  console.log(
    '✓ append-only reading revisions, zero/tax/quality updates, stable snapshots, current coverage, history and concurrent stale-edit rejection',
  );
  const factorCorrection = {
    conversion: { ...factorInput, factor: '12', source: 'Synthetic corrected factor' },
    reason: 'Supplier factor correction',
  };
  const replacement = await energy.correctConversion(actor, org.id, site.id, originalFactor.id, factorCorrection);
  assert.equal(replacement.supersedesId, originalFactor.id);
  assert.equal(replacement.revision, 2);
  assert.equal((await energy.conversionHistory(actor, org.id, site.id, replacement.id)).length, 2);
  assert.equal(
    (await db.consumptionRecord.findUniqueOrThrow({ where: { id: original.id } })).normalizedKwh.toString(),
    '1000',
  );
  const newest = (await energy.records(actor, org.id, site.id, 2020)).records[0];
  const converted = await energy.correctReading(actor, org.id, site.id, newest.id, {
    ...correction,
    reading: { ...reading, quantity: '100' },
    useLatestConversion: true,
  });
  assert.equal(converted.normalizedKwh.toString(), '1200');
  assert.equal(converted.conversionId, replacement.id);
  const feb = await energy.add(actor, org.id, site.id, { ...reading, month: '2020-02' });
  assert.equal(feb.conversionId, replacement.id);
  await assert.rejects(energy.correctConversion(actor, org.id, site.id, originalFactor.id, factorCorrection));
  await assert.rejects(energy.addConversion(actor, org.id, site.id, factorInput));
  await energy.addConversion(actor, org.id, site.id, { ...factorInput, firstMonth: '2021-01', lastMonth: '2021-12' });
  await assert.rejects(
    energy.correctConversion(actor, org.id, site.id, replacement.id, {
      ...factorCorrection,
      conversion: { ...factorCorrection.conversion, lastMonth: '2021-01' },
    }),
  );
  const reduced = await energy.correctConversion(actor, org.id, site.id, replacement.id, {
    ...factorCorrection,
    conversion: { ...factorCorrection.conversion, firstMonth: '2020-02' },
  });
  assert.equal(reduced.revision, 3);
  // Reuse a released validity interval without colliding with the immutable original row.
  await energy.addConversion(actor, org.id, site.id, { ...factorInput, lastMonth: '2020-01' });
  console.log(
    '✓ factor replacement, explicit historical re-normalization, retained references, overlap rejection and released validity dates',
  );
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet('Readings');
  sheet.addRow(['month', 'quantity']);
  sheet.addRow(['2020-03', '10']);
  const batch = await imports.upload(
    actor,
    org.id,
    site.id,
    meter.id,
    new Uint8Array(await workbook.xlsx.writeBuffer()),
  );
  const mapping = {
    sheet: 0,
    columns: { month: 0, quantity: 1 },
    defaults: { unit: 'm3', estimated: 'actual' },
    confirmed: true,
  };
  const preview = await imports.map(actor, org.id, site.id, batch.id, mapping);
  assert.equal(preview.status, 'READY');
  await energy.correctConversion(actor, org.id, site.id, reduced.id, {
    ...factorCorrection,
    conversion: { ...factorCorrection.conversion, firstMonth: '2020-02', factor: '13' },
  });
  await assert.rejects(imports.commit(actor, org.id, site.id, batch.id));
  await imports.map(actor, org.id, site.id, batch.id, mapping);
  await imports.commit(actor, org.id, site.id, batch.id);
  const imported = (await energy.records(actor, org.id, site.id, 2020)).records.find(
    (r) => r.periodStart.toISOString().slice(0, 7) === '2020-03',
  )!;
  const importedCorrection = await energy.correctReading(actor, org.id, site.id, imported.id, {
    reason: 'Correct imported quantity',
    useLatestConversion: false,
    reading: { meterId: meter.id, month: '2020-03', quantity: '20' },
  });
  assert.equal(importedCorrection.energyImportId, batch.id);
  assert.equal(importedCorrection.normalizedKwh.toString(), '260');
  await imports.commit(actor, org.id, site.id, batch.id);
  assert.equal((await energy.records(actor, org.id, site.id, 2020)).records.length, 3);
  console.log(
    '✓ changed factors invalidate import previews, corrected imports retain origin and retries do not duplicate active months',
  );
  const manager = actorFor(
    (await db.user.create({ data: { email: 'correction-manager@example.test', emailVerified: new Date() } })).id,
  );
  const member = await db.membership.create({
    data: { organisationId: org.id, userId: manager.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(energy.readingHistory(manager, org.id, site.id, original.id));
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: member.id, siteId: site.id } });
  assert.ok((await energy.readingHistory(manager, org.id, site.id, original.id)).length > 1);
  await assert.rejects(energy.correctReading(manager, org.id, site.id, converted.id, correction));
  await assert.rejects(energy.correctConversion(manager, org.id, site.id, reduced.id, factorCorrection));
  await sites.saveMeter(
    actor,
    org.id,
    site.id,
    { code: 'G', name: 'Changed meter', fuel: 'OIL', unit: 'litre' },
    meter.id,
  );
  const preserved = await energy.correctReading(actor, org.id, site.id, converted.id, {
    ...correction,
    reading: { ...reading, quantity: '110' },
  });
  assert.equal(preserved.sourceUnit, 'm3');
  assert.equal(preserved.fuel, 'GAS');
  assert.equal(preserved.normalizedKwh.toString(), '1320');
  await sites.archiveMeter(actor, org.id, site.id, meter.id);
  await energy.correctReading(actor, org.id, site.id, preserved.id, correction);
  assert.equal((await energy.records(actor, org.id, site.id, 2020)).records.length, 3);
  await sites.archiveSite(actor, org.id, site.id);
  await assert.rejects(
    energy.correctReading(actor, org.id, site.id, importedCorrection.id, {
      reason: 'Blocked archive edit',
      useLatestConversion: false,
      reading: { meterId: meter.id, month: '2020-03', quantity: '30' },
    }),
  );
  assert.ok((await db.auditEvent.count({ where: { action: 'energy.corrected' } })) > 0);
  console.log(
    '✓ assigned-site history, denied writes, retained historical meter units, archived-meter corrections and archived-site rejection',
  );
} finally {
  await cleanup();
}
