import type { PrismaClient } from '@prisma/client';
import { SiteService } from '../../src/server/sites';
import { EnergyService } from '../../src/server/energy';
import { DriverService } from '../../src/server/drivers';
import { actorFor } from '../../src/server/foundation';

/** Synthetic orthogonal design, only for disposable integration/browser databases. */
export async function seedMultidriver(db: PrismaClient) {
  const [database] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!database.name.startsWith('energiepad_test_'))
    throw Error('Multidriver fixtures require a disposable test database');
  const mail = { async send() {} },
    url = 'http://localhost:3101';
  const sites = new SiteService(db, mail, url),
    energy = new EnergyService(db, mail, url),
    drivers = new DriverService(db, mail, url);
  const email = `multidriver-${crypto.randomUUID()}@example.test`;
  const owner = actorFor((await db.user.create({ data: { email, emailVerified: new Date() } })).id);
  const org = await sites.createOrganisation(owner, { name: 'Multidriver test', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'MULTI', name: 'Multidriver site' });
  const two = await sites.saveMeter(owner, org.id, site.id, {
    code: 'TWO',
    name: 'Two drivers',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const three = await sites.saveMeter(owner, org.id, site.id, {
    code: 'THREE',
    name: 'Three drivers',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const monthly = [];
  for (let i = 0; i < 10; i++) {
    const month = `2020-${String(i + 1).padStart(2, '0')}`;
    const h = i < 8 ? (i & 1 ? 1 : -1) : 1,
      c = i < 8 ? (i & 2 ? 1 : -1) : 1,
      d = i < 8 ? (i & 4 ? 1 : -1) : 1;
    const hdd = 10 + h,
      cdd = 20 + c,
      daylight = 30 + d;
    // Full factorial noise is orthogonal to intercept and all three predictors.
    const noise = i < 8 ? 0.5 * h * c * d : -5;
    for (const [meter, quantity] of [
      [two, 100 + 2 * hdd + 3 * cdd + noise],
      [three, 100 + 2 * hdd + 3 * cdd + 4 * daylight + noise],
    ] as const)
      await energy.add(owner, org.id, site.id, {
        meterId: meter.id,
        month,
        quantity: String(quantity),
        estimated: false,
      });
    if (i < 9) {
      await drivers.add(owner, org.id, site.id, {
        month,
        driver: 'POPULATION',
        value: String(daylight),
        source: 'Synthetic orthogonal population',
      });
      monthly.push({
        month,
        days: new Date(Date.UTC(2020, i + 1, 0)).getUTCDate(),
        heatingDegreeDays: hdd,
        coolingDegreeDays: cdd,
        daylightHours: daylight,
      });
    }
  }
  const configuration = await db.weatherConfiguration.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      version: 1,
      latitude: '1',
      longitude: '1',
      timezone: 'UTC',
      heatingBase: '15.5',
      coolingBase: '18',
      source: 'Synthetic pinned weather',
      authorId: owner.userId,
    },
  });
  const weather = await db.weatherYear.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      configurationId: configuration.id,
      year: 2020,
      methodology: 'daily-mean-degree-days-v1',
      provenance: { synthetic: true, fixture: 'orthogonal-multidriver-v1' },
      daily: [],
      inputHash: 'synthetic-pinned-v1',
      authorId: owner.userId,
      monthly: [...monthly].reverse(),
    },
  });
  const newer = await db.weatherConfiguration.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      version: 2,
      latitude: '2',
      longitude: '2',
      timezone: 'UTC',
      heatingBase: '16',
      coolingBase: '20',
      source: 'Synthetic newer weather',
      authorId: owner.userId,
    },
  });
  await db.weatherYear.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      configurationId: newer.id,
      year: 2020,
      methodology: 'daily-mean-degree-days-v1',
      provenance: { synthetic: true },
      daily: [],
      inputHash: 'synthetic-newer-v2',
      authorId: owner.userId,
      monthly: monthly.map((m) => ({
        ...m,
        heatingDegreeDays: m.heatingDegreeDays * 2,
        coolingDegreeDays: m.coolingDegreeDays * 3,
        daylightHours: m.daylightHours * 4,
      })),
    },
  });
  return {
    email,
    owner,
    orgId: org.id,
    siteId: site.id,
    twoId: two.id,
    threeId: three.id,
    configurationId: configuration.id,
    newerId: newer.id,
    weatherId: weather.id,
  };
}
