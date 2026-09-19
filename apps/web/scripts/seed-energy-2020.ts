import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { db } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { uuid } from '../src/domain/policy';

// Explicitly invoked local demo seed. Never runs as part of migrations or plan seeding.
const organisationId = uuid.parse(process.argv[2]);
const databaseUrl = new URL(
  process.env.DATABASE_URL ?? 'postgresql://energiepad:local-only@127.0.0.1:55432/energiepad_v2',
);
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname))
  throw new Error('This synthetic seed is restricted to a local development database.');
const marker = 'synthetic-energy-demo-2020-v1';
const quantities = [12400, 11200, 10500, 8900, 7800, 7100, 7300, 7600, 8400, 9700, 10900, 12100];
const mailer = {
  async send() {
    throw new Error('Demo seeding must not send email.');
  },
};
const sites = new SiteService(db, mailer, 'http://localhost:3100');
const energy = new EnergyService(db, mailer, 'http://localhost:3100');
try {
  const membership = await db.membership.findFirst({
    where: { organisationId, role: 'OWNER', revokedAt: null, user: { emailVerified: { not: null } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw new Error('The selected workspace must have an active verified owner.');
  const actor = actorFor(membership.userId);
  let site = await db.site.findUnique({ where: { organisationId_code: { organisationId, code: 'TEST-2020' } } });
  if (site && (site.externalLegacyId !== marker || site.archivedAt))
    throw new Error('TEST-2020 is already used by another or archived site; nothing will be overwritten.');
  if (!site)
    site = await sites.createSite(actor, organisationId, {
      code: 'TEST-2020',
      name: 'Test Site — 2020 Demo',
      type: 'Synthetic test office',
      currency: 'GBP',
      externalLegacyId: marker,
      attributes: {
        effectiveFrom: '2020-01-01',
        population: '45',
        floorArea: '1200',
        weeklyHours: '50',
        vatPercent: '20',
      },
    });
  let meter = await db.meter.findUnique({ where: { siteId_code: { siteId: site.id, code: 'TEST-ELEC-2020' } } });
  if (meter && (meter.archivedAt || meter.fuel !== 'ELECTRICITY' || meter.unit !== 'kWh'))
    throw new Error('The demo meter has changed; nothing will be overwritten.');
  if (!meter)
    meter = await sites.saveMeter(actor, organisationId, site.id, {
      code: 'TEST-ELEC-2020',
      name: 'Test electricity meter',
      fuel: 'ELECTRICITY',
      unit: 'kWh',
    });
  const existing = await energy.records(actor, organisationId, site.id, 2020);
  for (const record of existing.records.filter((r) => r.meterId === meter.id)) {
    const monthIndex = record.periodStart.getUTCMonth();
    if (
      record.externalLegacyId !== `${marker}-${monthIndex + 1}` ||
      !record.sourceQuantity.equals(quantities[monthIndex])
    )
      throw new Error('Existing demo consumption differs from the seed; nothing will be overwritten.');
  }
  let created = 0;
  for (const [index, quantity] of quantities.entries()) {
    const month = `2020-${String(index + 1).padStart(2, '0')}`;
    if (existing.records.some((r) => r.meterId === meter.id && r.periodStart.toISOString().startsWith(month))) continue;
    await energy.add(actor, organisationId, site.id, {
      meterId: meter.id,
      month,
      quantity: String(quantity),
      estimated: true,
      netCost: new Prisma.Decimal(quantity).mul('0.15').toFixed(3),
      currency: 'GBP',
      vatPercent: '20',
      endUse: 'Whole building — synthetic test data',
      externalLegacyId: `${marker}-${index + 1}`,
    });
    created++;
  }
  const result = await energy.records(actor, organisationId, site.id, 2020);
  const readings = result.records.filter((r) => r.meterId === meter.id);
  if (readings.length !== 12 || result.coverage.find((c) => c.meterId === meter.id)?.missing.length !== 0)
    throw new Error('The demo data did not produce complete 2020 coverage.');
  const total = readings.reduce((sum, r) => sum.add(r.normalizedKwh), new Prisma.Decimal(0));
  console.log(
    JSON.stringify(
      {
        site: site.name,
        siteCode: site.code,
        siteId: site.id,
        year: 2020,
        created,
        readings: readings.length,
        totalKwh: total.toString(),
        synthetic: true,
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
