import assert from 'node:assert/strict';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mailer = { async send() {} };
const sites = new SiteService(db, mailer, 'http://localhost:3100');
const energy = new EnergyService(db, mailer, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'energy@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other-energy@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Energy tests', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other energy', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, {
    code: 'A',
    name: 'Energy site',
    attributes: { effectiveFrom: '2024-01-01', population: '0', weeklyHours: '40', floorArea: '100' },
  });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'MAIN',
    name: 'Main meter',
    fuel: 'ELECTRICITY',
    unit: 'MWh',
  });
  for (let month = 1; month <= 12; month++)
    await energy.add(actor, org.id, site.id, {
      meterId: meter.id,
      month: `2024-${String(month).padStart(2, '0')}`,
      quantity: '1.25',
      netCost: '100',
      vatPercent: '20',
      currency: 'gBp',
    });
  const result = await energy.records(actor, org.id, site.id, 2024);
  assert.equal(result.records.length, 12);
  assert.deepEqual(result.coverage[0].missing, []);
  assert.equal(result.records[0].normalizedKwh.toString(), '1250');
  assert.equal(result.records[0].grossCost?.toString(), '120');
  assert.equal(result.records[0].currency, 'GBP');
  assert.deepEqual(result.records[0].qualityFlags, []);
  assert.equal((result.records[0].attributeSnapshot as { population: string }).population, '0');
  console.log('✓ 12 months, conversion, VAT, currency, zero drivers and complete coverage');
  await assert.rejects(energy.add(actor, org.id, site.id, { meterId: meter.id, month: '2024-01', quantity: '10' }));
  await assert.rejects(energy.add(stranger, org.id, site.id, { meterId: meter.id, month: '2025-01', quantity: '10' }));
  await assert.rejects(
    energy.add(stranger, other.id, site.id, { meterId: meter.id, month: '2025-01', quantity: '10' }),
  );
  await assert.rejects(energy.records(stranger, org.id, site.id, 2024));
  console.log('✓ duplicates and cross-tenant access rejected');
  const manager = actorFor(
    (await db.user.create({ data: { email: 'manager-energy@example.test', emailVerified: new Date() } })).id,
  );
  const membership = await db.membership.create({
    data: { organisationId: org.id, userId: manager.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(energy.records(manager, org.id, site.id, 2024));
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: membership.id, siteId: site.id } });
  assert.equal((await energy.records(manager, org.id, site.id, 2024)).records.length, 12);
  await assert.rejects(energy.add(manager, org.id, site.id, { meterId: meter.id, month: '2025-01', quantity: '10' }));
  console.log('✓ assigned-site read access and write restrictions');
  const physical = await sites.saveMeter(actor, org.id, site.id, { code: 'GAS', name: 'Gas', fuel: 'GAS', unit: 'm3' });
  await assert.rejects(energy.add(actor, org.id, site.id, { meterId: physical.id, month: '2024-01', quantity: '1' }));
  const conversionInput = {
    meterId: physical.id,
    firstMonth: '2024-01',
    lastMonth: '2024-06',
    factor: '10.123456',
    source: 'Synthetic test factor, not for production',
  };
  await assert.rejects(energy.addConversion(stranger, org.id, site.id, conversionInput));
  await assert.rejects(energy.addConversion(manager, org.id, site.id, conversionInput));
  await assert.rejects(energy.addConversion(actor, org.id, site.id, { ...conversionInput, meterId: meter.id }));
  const conversion = await energy.addConversion(actor, org.id, site.id, conversionInput);
  await assert.rejects(
    energy.addConversion(actor, org.id, site.id, { ...conversionInput, firstMonth: '2024-06', lastMonth: '2024-12' }),
  );
  await assert.rejects(energy.add(actor, org.id, site.id, { meterId: physical.id, month: '2023-12', quantity: '100' }));
  await assert.rejects(energy.add(actor, org.id, site.id, { meterId: physical.id, month: '2024-07', quantity: '100' }));
  const gasRecord = await energy.add(actor, org.id, site.id, {
    meterId: physical.id,
    month: '2024-06',
    quantity: '100',
  });
  assert.equal(gasRecord.normalizedKwh.toString(), '1012.346');
  assert.equal(gasRecord.conversionId, conversion.id);
  const nextVersions = await Promise.allSettled([
    energy.addConversion(actor, org.id, site.id, {
      ...conversionInput,
      firstMonth: '2024-07',
      lastMonth: '2024-12',
      factor: '11',
    }),
    energy.addConversion(actor, org.id, site.id, {
      ...conversionInput,
      firstMonth: '2024-07',
      lastMonth: '2024-12',
      factor: '12',
    }),
  ]);
  assert.equal(nextVersions.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal(
    (await db.consumptionRecord.findUniqueOrThrow({ where: { id: gasRecord.id } })).normalizedKwh.toString(),
    '1012.346',
  );
  await assert.rejects(db.unitConversionVersion.update({ where: { id: conversion.id }, data: { factor: '99' } }));
  await assert.rejects(db.unitConversionVersion.delete({ where: { id: conversion.id } }));
  await sites.saveMeter(
    actor,
    org.id,
    site.id,
    { code: physical.code, name: physical.name, fuel: 'OIL', unit: 'litre' },
    physical.id,
  );
  await assert.rejects(energy.add(actor, org.id, site.id, { meterId: physical.id, month: '2024-08', quantity: '100' }));
  console.log('✓ sourced conversion dates, precision, immutability, snapshot stability, concurrency and meter changes');
  const missingSite = await sites.createSite(actor, org.id, { code: 'B', name: 'No attributes' });
  const second = await sites.saveMeter(actor, org.id, missingSite.id, {
    code: 'MAIN',
    name: 'Missing drivers',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const input = { meterId: second.id, month: '2024-01', quantity: '0', estimated: true, netCost: '0', currency: 'GBP' };
  const concurrent = await Promise.allSettled([
    energy.add(actor, org.id, missingSite.id, input),
    energy.add(actor, org.id, missingSite.id, input),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
  const incomplete = await energy.records(actor, org.id, missingSite.id, 2024);
  assert.equal(incomplete.coverage[0].missing.length, 11);
  assert.equal(incomplete.records[0].grossCost, null);
  assert.ok((incomplete.records[0].qualityFlags as string[]).includes('Missing population'));
  await sites.archiveMeter(actor, org.id, missingSite.id, second.id);
  assert.equal((await energy.records(actor, org.id, missingSite.id, 2024)).records.length, 1);
  await assert.rejects(energy.add(actor, org.id, missingSite.id, { ...input, month: '2024-02' }));
  console.log('✓ unsupported conversions, concurrent duplicates, missing drivers and archival');
} finally {
  await cleanup();
}
