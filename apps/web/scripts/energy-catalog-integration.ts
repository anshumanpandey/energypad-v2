import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { TariffService } from '../src/server/tariffs';
import { EnergyCatalogService } from '../src/server/energy-catalog';
import { EnergyImportService } from '../src/server/energy-import';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} };
const sites = new SiteService(db, mail, 'http://localhost:3100');
const tariffs = new TariffService(db, mail, 'http://localhost:3100');
const catalog = new EnergyCatalogService(db, mail, 'http://localhost:3100');
const energy = new EnergyImportService(db, mail, 'http://localhost:3100');
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'catalog@example.test', emailVerified: new Date() } })).id,
  );
  const other = actorFor(
    (await db.user.create({ data: { email: 'other-catalog@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(owner, { name: 'Catalog', currency: 'GBP', timezone: 'UTC' });
  const otherOrg = await sites.createOrganisation(other, { name: 'Other catalog', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'A', name: 'Site A' });
  const second = await sites.createSite(owner, org.id, { code: 'B', name: 'Site B' });
  const entry = {
    kind: 'FUEL',
    code: 'POWER',
    fuel: 'ELECTRICITY',
    name: 'Grid power',
    color: '#123abc',
    source: 'Synthetic source',
    legacySource: 'root',
    legacyId: '1',
  };
  const fuel = await catalog.add(owner, org.id, site.id, entry);
  const end = await catalog.add(owner, org.id, site.id, {
    ...entry,
    kind: 'END_USE',
    code: 'LIGHT',
    name: 'Lighting',
    legacyId: '2',
  });
  assert.equal(fuel.color, '#123ABC');
  assert.equal((await catalog.list(owner, org.id, second.id)).length, 2);
  await assert.rejects(catalog.add(owner, org.id, site.id, { ...entry, code: 'DIFFERENT' }));
  await assert.rejects(catalog.list(other, otherOrg.id, site.id));
  const siteUse = {
    code: 'LIGHTING',
    name: 'Office lights',
    fuel: 'ELECTRICITY',
    source: 'Synthetic allocation reference',
    fuelCatalogId: fuel.id,
    endUseCatalogId: end.id,
  };
  const use = await tariffs.addUse(owner, org.id, site.id, siteUse);
  await assert.rejects(tariffs.addUse(owner, org.id, second.id, { ...siteUse, fuel: 'GAS' }));
  const meter = await sites.saveMeter(owner, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const input = {
    meterId: meter.id,
    month: '2020-01',
    quantity: '100',
    endUse: 'Original imported label',
    energyUseCode: 'lighting',
  };
  const reading = await energy.add(owner, org.id, site.id, input);
  assert.equal(reading.energyUseId, use.id);
  const snapshot = reading.energyUseSnapshot as { fuelCatalog: { name: string; revision: number } };
  assert.equal(snapshot.fuelCatalog.name, 'Grid power');
  const correction = {
    entry: { ...entry, name: 'Electricity supply', color: '#ABCDEF' },
    reason: 'Correct display label',
  };
  const changed = await catalog.correct(owner, org.id, second.id, fuel.id, correction);
  await assert.rejects(catalog.correct(owner, org.id, site.id, fuel.id, correction));
  await assert.rejects(tariffs.addUse(owner, org.id, second.id, siteUse));
  const freshUse = await tariffs.addUse(owner, org.id, second.id, { ...siteUse, fuelCatalogId: changed.id });
  const corrected = await energy.correctReading(owner, org.id, site.id, reading.id, {
    reading: { meterId: meter.id, month: '2020-01', quantity: '200', endUse: 'Original imported label' },
    reason: 'Correct quantity only',
    useLatestConversion: false,
  });
  assert.equal(corrected.energyUseId, use.id);
  assert.deepEqual(corrected.energyUseSnapshot, reading.energyUseSnapshot);
  assert.equal(corrected.endUse, 'Original imported label');
  const unlink = await energy.correctReading(owner, org.id, site.id, corrected.id, {
    reading: { ...input, energyUseCode: null },
    reason: 'Remove mistaken association',
    useLatestConversion: false,
  });
  assert.equal(unlink.energyUseId, null);
  assert.equal((await energy.records(owner, org.id, site.id, 2020)).records.length, 1);
  const secondMeter = await sites.saveMeter(owner, org.id, second.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const secondReading = await energy.add(owner, org.id, second.id, { ...input, meterId: secondMeter.id });
  assert.equal(secondReading.energyUseId, freshUse.id);
  assert.equal((secondReading.energyUseSnapshot as typeof snapshot).fuelCatalog.name, 'Electricity supply');
  await tariffs.addUse(owner, org.id, site.id, { code: 'GASUSE', name: 'Gas use', fuel: 'GAS', source: 'Synthetic' });
  await assert.rejects(energy.add(owner, org.id, site.id, { ...input, month: '2020-02', energyUseCode: 'GASUSE' }));
  console.log(
    '✓ shared organisation catalog, immutable source identity, pinned versions, reading snapshots and explicit unlink corrections',
  );
  const races = await Promise.allSettled([
    catalog.correct(owner, org.id, site.id, changed.id, correction),
    catalog.correct(owner, org.id, site.id, changed.id, correction),
  ]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  const current = (await catalog.list(owner, org.id, site.id)).find((r) => r.kind === 'FUEL')!;
  const retired = await catalog.correct(owner, org.id, site.id, current.id, {
    entry: { ...correction.entry, retired: true },
    reason: 'Retire obsolete label',
  });
  await assert.rejects(tariffs.addUse(owner, org.id, site.id, { ...siteUse, code: 'NEW', fuelCatalogId: retired.id }));
  await assert.rejects(db.energyCatalogVersion.update({ where: { id: fuel.id }, data: { name: 'Tamper' } }));
  assert.equal((await catalog.history(owner, org.id, site.id, fuel.id)).length, 4);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Readings');
  sheet.addRow(['month', 'quantity', 'unit', 'siteUse']);
  sheet.addRow(['2020-02', 100, 'kWh', 'LIGHTING']);
  const batch = await energy.upload(owner, org.id, site.id, meter.id, new Uint8Array(await book.xlsx.writeBuffer()));
  const mapping = {
    sheet: 0,
    columns: { month: 0, quantity: 1, unit: 2, energyUseCode: 3 },
    defaults: { estimated: 'actual', endUse: 'Legacy lighting' },
    confirmed: true,
  };
  assert.equal((await energy.map(owner, org.id, site.id, batch.id, mapping)).status, 'READY');
  await energy.commit(owner, org.id, site.id, batch.id);
  await energy.commit(owner, org.id, site.id, batch.id);
  const imported = await db.consumptionRecord.findFirstOrThrow({ where: { energyImportId: batch.id } });
  assert.equal(imported.energyUseId, use.id);
  assert.equal(imported.endUse, 'Legacy lighting');
  assert.deepEqual(imported.energyUseSnapshot, reading.energyUseSnapshot);
  assert.equal((await energy.records(owner, org.id, site.id, 2020)).records.length, 2);
  console.log(
    '✓ retired entries block new site links, concurrent edits are fenced, imports retain labels and pinned snapshots without duplicate readings',
  );
  const manager = actorFor(
    (await db.user.create({ data: { email: 'manager-catalog@example.test', emailVerified: new Date() } })).id,
  );
  const member = await db.membership.create({
    data: { organisationId: org.id, userId: manager.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(catalog.list(manager, org.id, site.id));
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: member.id, siteId: site.id } });
  assert.equal((await catalog.list(manager, org.id, site.id)).length, 2);
  await assert.rejects(catalog.correct(manager, org.id, site.id, retired.id, correction));
  await assert.rejects(catalog.add(owner, org.id, site.id, { ...entry, code: 'INVALID', color: 'red', legacyId: '8' }));
  await sites.archiveSite(owner, org.id, site.id);
  await assert.rejects(catalog.add(owner, org.id, site.id, { ...entry, code: 'ARCHIVED', legacyId: '9' }));
  console.log(
    '✓ assigned-site reads, write restrictions, validated colours, audit provenance and archived-site protection',
  );
} finally {
  await cleanup();
}
