import assert from 'node:assert/strict';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { WeatherService } from '../src/server/weather/service';
import { OpenMeteoProvider } from '../src/server/weather/provider';
import { syntheticWeather } from '../tests/fixtures/weather';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mailer = { async send() {} };
const sites = new SiteService(db, mailer, 'http://localhost:3100');
let calls = 0,
  fail = false,
  incomplete = false,
  afterFetch: (() => Promise<void>) | undefined;
const provider = new OpenMeteoProvider({
  fetch: async (url) => {
    calls++;
    if (afterFetch) await afterFetch();
    if (fail) return new Response('Unavailable', { status: 503 });
    const raw = syntheticWeather(Number(new URL(String(url)).searchParams.get('start_date')!.slice(0, 4)));
    if (incomplete) raw.daily.time.pop();
    return Response.json(raw);
  },
});
const weather = new WeatherService(db, mailer, 'http://localhost:3100', provider);
const energy = new EnergyService(db, mailer, 'http://localhost:3100');
const settings = {
  latitude: '51.5',
  longitude: '-0.12',
  timezone: 'Europe/London',
  heatingBase: '15',
  coolingBase: '20',
  source: 'Synthetic configuration',
};
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'weather@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other-weather@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Weather', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'A', name: 'Weather site' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  for (let month = 1; month <= 12; month++)
    await energy.add(actor, org.id, site.id, {
      meterId: meter.id,
      month: `2020-${String(month).padStart(2, '0')}`,
      quantity: '100',
    });
  const before = await db.consumptionRecord.findMany({ where: { siteId: site.id }, orderBy: { periodStart: 'asc' } });
  const config = await weather.configure(actor, org.id, site.id, settings);
  const input = { configurationId: config.id, year: 2020 };
  await assert.rejects(weather.enrich(stranger, other.id, site.id, input));
  await assert.rejects(weather.list(stranger, org.id, site.id, 2020));
  assert.equal(calls, 0);
  const results = await Promise.all([
    weather.enrich(actor, org.id, site.id, input),
    weather.enrich(actor, org.id, site.id, input),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal((results[0].daily as unknown[]).length, 366);
  assert.equal((results[0].monthly as unknown[]).length, 12);
  const count = calls;
  await weather.enrich(actor, org.id, site.id, input);
  assert.equal(calls, count);
  assert.equal(await db.auditEvent.count({ where: { action: 'weather.enriched' } }), 1);
  assert.deepEqual(
    await db.consumptionRecord.findMany({ where: { siteId: site.id }, orderBy: { periodStart: 'asc' } }),
    before,
  );
  console.log(
    '✓ full leap year, 12 monthly aggregates, idempotent/concurrent results, tenant checks and unchanged consumption',
  );
  const newer = await weather.configure(actor, org.id, site.id, { ...settings, heatingBase: '16' });
  assert.equal(newer.version, 2);
  const revised = await weather.enrich(actor, org.id, site.id, { configurationId: newer.id, year: 2020 });
  assert.notDeepEqual(revised.monthly, results[0].monthly);
  assert.equal((await weather.list(actor, org.id, site.id, 2020)).results.length, 2);
  await assert.rejects(db.weatherConfiguration.update({ where: { id: config.id }, data: { heatingBase: '17' } }));
  await assert.rejects(db.weatherYear.delete({ where: { id: results[0].id } }));
  console.log('✓ versioned settings/results, retained provenance and database immutability');
  fail = true;
  await assert.rejects(weather.enrich(actor, org.id, site.id, { ...input, year: 2021 }));
  assert.equal(await db.weatherYear.count({ where: { year: 2021 } }), 0);
  fail = false;
  incomplete = true;
  await assert.rejects(weather.enrich(actor, org.id, site.id, { ...input, year: 2021 }));
  assert.equal(await db.weatherYear.count({ where: { year: 2021 } }), 0);
  incomplete = false;
  await weather.enrich(actor, org.id, site.id, { ...input, year: 2021 });
  console.log('✓ provider and incomplete-data failures leave no partial data; explicit retry succeeds');
  const manager = actorFor(
    (await db.user.create({ data: { email: 'weather-manager@example.test', emailVerified: new Date() } })).id,
  );
  const member = await db.membership.create({
    data: { userId: manager.userId, organisationId: org.id, role: 'SITE_MANAGER' },
  });
  await assert.rejects(weather.list(manager, org.id, site.id, 2020));
  await db.siteAssignment.create({ data: { organisationId: org.id, siteId: site.id, membershipId: member.id } });
  assert.equal((await weather.list(manager, org.id, site.id, 2020)).results.length, 2);
  await assert.rejects(weather.configure(manager, org.id, site.id, settings));
  await assert.rejects(weather.enrich(manager, org.id, site.id, input));
  const admin = actorFor(
    (await db.user.create({ data: { email: 'weather-admin@example.test', emailVerified: new Date() } })).id,
  );
  const adminMember = await db.membership.create({
    data: { organisationId: org.id, userId: admin.userId, role: 'ADMIN' },
  });
  afterFetch = async () => {
    await db.membership.update({ where: { id: adminMember.id }, data: { role: 'VIEWER' } });
  };
  await assert.rejects(weather.enrich(admin, org.id, site.id, { ...input, year: 2022 }));
  assert.equal(await db.weatherYear.count({ where: { year: 2022 } }), 0);
  afterFetch = async () => {
    await sites.archiveSite(actor, org.id, site.id);
  };
  await assert.rejects(weather.enrich(actor, org.id, site.id, { ...input, year: 2023 }));
  assert.equal(await db.weatherYear.count({ where: { year: 2023 } }), 0);
  console.log('✓ assigned-site reads, restricted writes, revoked access and archive rechecks after network I/O');
} finally {
  await cleanup();
}
