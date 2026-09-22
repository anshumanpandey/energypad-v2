import assert from 'node:assert/strict';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { TariffService } from '../src/server/tariffs';
import { EnergyService } from '../src/server/energy';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} };
const sites = new SiteService(db, mail, 'http://localhost:3100');
const tariffs = new TariffService(db, mail, 'http://localhost:3100');
const energy = new EnergyService(db, mail, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'tariff@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other-tariff@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Tariffs', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'A', name: 'Site A' });
  const second = await sites.createSite(actor, org.id, { code: 'B', name: 'Site B' });
  const input = {
    code: 'LIGHT',
    name: 'Lighting',
    fuel: 'ELECTRICITY',
    source: 'Synthetic reference',
    legacySource: 'root',
    fuelLegacyId: '1',
    endUseLegacyId: '2',
    associationLegacyId: '3',
    associationLegacyTable: 'BusinessFuelUses',
  };
  const use = await tariffs.addUse(actor, org.id, site.id, input);
  await assert.rejects(tariffs.addUse(actor, org.id, site.id, { ...input, code: 'ALIAS' }));
  await assert.rejects(tariffs.addUse(stranger, other.id, site.id, input));
  const band = {
    name: 'Day',
    days: [1, 2, 3, 4, 5, 6, 7],
    startTime: '00:00',
    endTime: '24:00',
    rate: '0.15',
    legacyId: '4',
  };
  const data = {
    energyUseId: use.id,
    name: 'Electricity 2020',
    firstDay: '2020-01-01',
    lastDay: '2020-12-31',
    currency: 'gbp',
    rateUnit: 'kWh',
    taxBasis: 'NET',
    vatPercent: '20',
    timezone: 'Europe/London',
    source: 'Synthetic rate card',
    legacySource: 'root',
    pricingLegacyId: '5',
    bands: [band],
  };
  await assert.rejects(tariffs.add(actor, org.id, second.id, data));
  const races = await Promise.allSettled([
    tariffs.add(actor, org.id, site.id, data),
    tariffs.add(actor, org.id, site.id, data),
  ]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  const original = (await tariffs.list(actor, org.id, site.id)).tariffs[0];
  assert.equal(original.currency, 'GBP');
  await assert.rejects(tariffs.add(actor, org.id, site.id, { ...data, bands: [band, band] }));
  await assert.rejects(tariffs.list(stranger, org.id, site.id));
  await assert.rejects(tariffs.history(stranger, other.id, site.id, original.id));
  console.log(
    '✓ site and tenant isolation, stable legacy associations, explicit rates and concurrent overlap rejection',
  );
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const reading = await energy.add(actor, org.id, site.id, {
    meterId: meter.id,
    month: '2020-01',
    quantity: '100',
    netCost: '15',
    currency: 'GBP',
    vatPercent: '20',
  });
  const correction = {
    tariff: { ...data, lastDay: '2020-06-30', bands: [{ ...band, rate: '0' }] },
    reason: 'Correct synthetic dates and price',
  };
  const revised = await tariffs.correct(actor, org.id, site.id, original.id, correction);
  assert.equal(revised.revision, 2);
  await assert.rejects(tariffs.correct(actor, org.id, site.id, original.id, correction));
  await tariffs.add(actor, org.id, site.id, { ...data, firstDay: '2020-07-01' });
  await assert.rejects(tariffs.correct(actor, org.id, site.id, revised.id, { tariff: data, reason: 'Would overlap' }));
  assert.equal((await tariffs.history(actor, org.id, site.id, revised.id)).length, 2);
  assert.equal((await tariffs.list(actor, org.id, site.id)).tariffs.length, 2);
  assert.deepEqual(await db.consumptionRecord.findUnique({ where: { id: reading.id } }), reading);
  await assert.rejects(db.tariffVersion.update({ where: { id: original.id }, data: { name: 'Changed' } }));
  await assert.rejects(db.siteEnergyUse.delete({ where: { id: use.id } }));
  const edits = await Promise.allSettled([
    tariffs.correct(actor, org.id, site.id, revised.id, correction),
    tariffs.correct(actor, org.id, site.id, revised.id, correction),
  ]);
  assert.equal(edits.filter((r) => r.status === 'fulfilled').length, 1);
  console.log(
    '✓ tariff revisions, released validity ranges, preserved bills, immutable history and concurrent/stale correction protection',
  );
  const manager = actorFor(
    (await db.user.create({ data: { email: 'manager-tariff@example.test', emailVerified: new Date() } })).id,
  );
  const member = await db.membership.create({
    data: { organisationId: org.id, userId: manager.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(tariffs.list(manager, org.id, site.id));
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: member.id, siteId: site.id } });
  assert.equal((await tariffs.history(manager, org.id, site.id, original.id)).length, 3);
  await assert.rejects(tariffs.addUse(manager, org.id, site.id, { ...input, code: 'NO' }));
  await assert.rejects(tariffs.correct(manager, org.id, site.id, original.id, correction));
  await sites.archiveSite(actor, org.id, site.id);
  await assert.rejects(tariffs.add(actor, org.id, site.id, { ...data, firstDay: '2021-01-01', lastDay: '2021-12-31' }));
  assert.equal(await db.auditEvent.count({ where: { action: 'energy.tariff_corrected' } }), 2);
  console.log('✓ assigned-site history, restricted writes, audit events and archive protection');
} finally {
  await cleanup();
}
