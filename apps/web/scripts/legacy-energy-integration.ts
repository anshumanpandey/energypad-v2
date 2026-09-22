import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { TariffService } from '../src/server/tariffs';
import { LegacyEnergyMigration } from '../src/server/legacy/energy-migration';
import type { LegacyEnergyBundle } from '../src/server/legacy/energy-input';
const { db, databaseUrl, cleanup } = await testDatabase();
const directory = await mkdtemp(path.join(tmpdir(), 'energy-migration-'));
const mail = { async send() {} };
const sites = new SiteService(db, mail, 'http://localhost:3100'),
  energy = new EnergyService(db, mail, 'http://localhost:3100'),
  tariffs = new TariffService(db, mail, 'http://localhost:3100'),
  migration = new LegacyEnergyMigration(db, mail, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'energy-migration@example.test', emailVerified: new Date() } })).id,
  );
  const other = actorFor(
    (await db.user.create({ data: { email: 'foreign-energy@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Migration', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'A', name: 'Migration site' });
  const first = await sites.saveMeter(actor, org.id, site.id, {
    code: 'G1',
    name: 'Gas energy',
    fuel: 'GAS',
    unit: 'kWh',
  });
  const second = await sites.saveMeter(actor, org.id, site.id, {
    code: 'G2',
    name: 'Gas volume',
    fuel: 'GAS',
    unit: 'm3',
  });
  await tariffs.addUse(actor, org.id, site.id, {
    code: 'HEAT',
    name: 'Heating',
    fuel: 'GAS',
    source: 'Reviewed source scope',
  });
  const conversion = await energy.addConversion(actor, org.id, site.id, {
    meterId: second.id,
    firstMonth: '2020-01',
    lastMonth: '2020-12',
    factor: '10',
    source: 'Approved synthetic gas factor',
  });
  const source = {
    id: 'r1',
    siteId: 'site-1',
    fuelSourceId: 'gas',
    usedInId: 'heat',
    date: 'January 2020',
    consumption: '0',
    totalCost: '100',
    vat: '0.2',
    vatCost: '19',
    conversionFactor: '1',
    fuelUnit: 'kwh',
    created_at: '2020-02-01T12:30:00+01:00',
    updated_at: '2020-02-02T12:30:00+01:00',
    population: '20',
    workingHours: '120',
  };
  const decision = {
    legacyId: 'r1',
    meterListId: 'list1',
    meterId: first.id,
    month: '2020-01',
    sourceUnit: 'kWh' as const,
    estimated: false,
    currency: 'GBP',
    costBasis: 'NET' as const,
    vatBasis: 'FRACTION' as const,
    conversionVersion: 'energy-si-v1',
    factorBasis: 'KWH_PER_SOURCE_UNIT' as const,
    acceptCostDifference: true,
    population: 'MONTHLY_AVERAGE' as const,
    workingHours: 'MONTHLY_TOTAL' as const,
    reason: 'Reviewed monthly scope, source spelling and one-meter assignment; retain supplied VAT discrepancy',
  };
  const bundle: LegacyEnergyBundle = {
    source: 'synthetic',
    reference: 'Reviewed synthetic source export',
    tables: {
      BusinessFuelsSize: [
        { id: 'list1', meters: 'G-001; G-002', siteId: 'site-1', fuelSourceId: 'gas', usedInId: 'heat' },
      ],
      UtilityConsumptions: [
        source,
        {
          ...source,
          id: 'r2',
          consumption: '2',
          totalCost: '120',
          vat: '20',
          vatCost: '20',
          conversionFactor: '10',
          fuelUnit: 'm³',
        },
      ],
    },
    decisions: {
      meters: [
        {
          legacyId: 'list1',
          siteId: site.id,
          energyUseCode: 'HEAT',
          format: 'SEMICOLON',
          tokens: [
            { token: 'G-001', meterId: first.id },
            { token: 'G-002', meterId: second.id },
          ],
          reason: 'Reviewed two distinct meter identifiers; no total is duplicated',
        },
      ],
      readings: [
        decision,
        {
          ...decision,
          legacyId: 'r2',
          meterId: second.id,
          sourceUnit: 'm3',
          costBasis: 'GROSS',
          vatBasis: 'PERCENT',
          conversionVersion: conversion.id,
        },
      ],
      existingDrivers: 'REJECT',
    },
  };
  const before = await db.auditEvent.count();
  const report = await migration.preview(actor, org.id, {
    ...bundle,
    tables: {
      ...bundle.tables,
      UtilityConsumptions: bundle.tables.UtilityConsumptions.map((r) => ({ ...r, password: 'discard-this-secret' })),
    },
  });
  assert.equal(report.ready, true, JSON.stringify(report.issues));
  assert.equal(JSON.stringify(report).includes('discard-this-secret'), false);
  assert.equal(report.plan.readings[0].reconciliation.vatDifference, '1');
  assert.equal(String(report.plan.readings[1].prepared.netCost), '100');
  assert.equal(report.plan.drivers.length, 2);
  assert.equal(report.totals.length, 2);
  assert.equal(report.totals[1].normalizedKwh, '20');
  const preserved = structuredClone(bundle);
  preserved.decisions.readings.forEach((r) => {
    r.population = 'PRESERVE_ONLY';
    r.workingHours = 'PRESERVE_ONLY';
  });
  assert.equal((await migration.preview(actor, org.id, preserved)).plan.drivers.length, 0);
  assert.equal(await db.auditEvent.count(), before);
  await assert.rejects(migration.preview(other, org.id, bundle));
  for (const mutate of [
    (b: LegacyEnergyBundle) => {
      b.decisions.meters[0].tokens.pop();
    },
    (b: LegacyEnergyBundle) => {
      b.decisions.readings[0].acceptCostDifference = false;
    },
    (b: LegacyEnergyBundle) => {
      b.tables.UtilityConsumptions[1].population = '21';
    },
    (b: LegacyEnergyBundle) => {
      b.decisions.readings[1].conversionVersion = 'wrong-version';
    },
    (b: LegacyEnergyBundle) => {
      b.tables.UtilityConsumptions[1].conversionFactor = '11';
    },
    (b: LegacyEnergyBundle) => {
      b.tables.UtilityConsumptions[1].siteId = 'other-source-site';
    },
  ]) {
    const changed = structuredClone(bundle);
    mutate(changed);
    assert.equal((await migration.preview(actor, org.id, changed)).ready, false);
  }
  await db.meter.update({ where: { id: first.id }, data: { name: 'Updated destination name' } });
  await assert.rejects(migration.apply(actor, org.id, bundle, report));
  const fresh = await migration.preview(actor, org.id, bundle);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION reject_energy_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."externalLegacyId"='r2' THEN RAISE EXCEPTION 'late failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER reject_energy_test BEFORE INSERT ON "ConsumptionRecord" FOR EACH ROW EXECUTE FUNCTION reject_energy_test()`,
  );
  const auditBefore = await db.auditEvent.count();
  await assert.rejects(migration.apply(actor, org.id, bundle, fresh));
  assert.equal(await db.consumptionRecord.count(), 0);
  assert.equal(await db.driverObservation.count(), 0);
  assert.equal(await db.legacyEnergyBatch.count(), 0);
  assert.equal(await db.legacyEnergyRow.count(), 0);
  assert.equal(await db.auditEvent.count(), auditBefore);
  await db.$executeRawUnsafe('DROP TRIGGER reject_energy_test ON "ConsumptionRecord"');
  const results = await Promise.all([
    migration.apply(actor, org.id, bundle, fresh),
    migration.apply(actor, org.id, bundle, fresh),
  ]);
  assert.equal(results[0].batch.id, results[1].batch.id);
  assert.equal(results.filter((r) => r.reused).length, 1);
  assert.equal(await db.driverObservation.count(), 2);
  assert.equal(await db.consumptionRecord.count(), 2);
  assert.equal(await db.legacyEnergyRow.count(), 3);
  const reading = await db.consumptionRecord.findFirstOrThrow({ where: { externalLegacyId: 'r1' } });
  const evidence = reading.sourceProvenance as { original: typeof source };
  assert.equal(evidence.original.created_at, source.created_at);
  assert.equal(evidence.original.vatCost, '19');
  assert.equal(reading.vatCost?.toString(), '20');
  const corrected = await energy.correctReading(actor, org.id, site.id, reading.id, {
    reading: {
      meterId: first.id,
      month: '2020-01',
      quantity: '5',
      estimated: false,
      netCost: '200',
      vatPercent: '20',
      currency: 'GBP',
      endUse: '',
      externalLegacyId: 'r1',
    },
    reason: 'Corrected source reading',
    useLatestConversion: false,
  });
  assert.deepEqual(corrected.sourceProvenance, reading.sourceProvenance);
  await assert.rejects(
    db.consumptionRecord.create({
      data: {
        ...corrected,
        id: crypto.randomUUID(),
        supersedesId: corrected.id,
        revision: 3,
        sourceProvenance: { removed: true },
        energyUseSnapshot: corrected.energyUseSnapshot as Prisma.InputJsonValue,
        attributeSnapshot: corrected.attributeSnapshot as Prisma.InputJsonValue,
        qualityFlags: corrected.qualityFlags as Prisma.InputJsonValue,
      },
    }),
  );
  await assert.rejects(db.legacyEnergyRow.deleteMany());
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE "LegacyEnergyBatch" CASCADE'));
  // Reuse the identical reviewed meter mapping for another month; JSONB key order must not break comparison.
  const next = structuredClone(bundle);
  next.decisions.readings.forEach((d) => {
    d.month = '2020-02';
    d.legacyId += '-feb';
  });
  next.tables.UtilityConsumptions.forEach((r) => {
    r.id += '-feb';
    r.date = 'February 2020';
  });
  next.decisions.existingDrivers = 'REUSE_EQUAL';
  await db.driverObservation.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      month: new Date('2020-02-01'),
      driver: 'POPULATION',
      value: '20',
      source: 'Existing reviewed monthly driver',
      authorId: actor.userId,
    },
  });
  const nextReport = await migration.preview(actor, org.id, next);
  assert.equal(nextReport.ready, true, JSON.stringify(nextReport.issues));
  assert.ok(nextReport.plan.drivers.some(([, d]) => d.existingId));
  const conflictingExisting = structuredClone(next);
  conflictingExisting.tables.UtilityConsumptions.forEach((r) => {
    r.population = '21';
  });
  assert.equal((await migration.preview(actor, org.id, conflictingExisting)).ready, false);
  await migration.apply(actor, org.id, next, nextReport);
  assert.equal(await db.legacyEnergyRow.count({ where: { table: 'BusinessFuelsSize' } }), 1);
  const file = path.join(directory, 'bundle.json'),
    output = path.join(directory, 'report.json');
  await writeFile(file, JSON.stringify(bundle));
  await writeFile(output, JSON.stringify(fresh));
  const run = (mode: string) =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', `scripts/legacy-energy-${mode}.ts`, org.id, actor.userId, file, output],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
    );
  assert.equal(run('apply').status, 0);
  const saved = await readFile(output, 'utf8');
  assert.equal(run('preview').status, 1);
  assert.equal(await readFile(output, 'utf8'), saved);
  const emptyFile = path.join(directory, 'ready.json');
  const onlyMeters = structuredClone(bundle);
  onlyMeters.tables.UtilityConsumptions = [];
  onlyMeters.decisions.readings = [];
  await writeFile(file, JSON.stringify(onlyMeters));
  const previewCli = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/legacy-energy-preview.ts', org.id, actor.userId, file, emptyFile],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
  );
  assert.equal(previewCli.status, 0, previewCli.stderr);
  assert.equal((await stat(emptyFile)).mode & 0o777, 0o600);
  const member = await db.membership.findFirstOrThrow({ where: { organisationId: org.id, userId: actor.userId } });
  await db.membership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
  await assert.rejects(migration.apply(actor, org.id, bundle, fresh));
  console.log(
    '✓ reviewed meter splits, scope/factor/tax/driver blockers, source preservation, stale signature, late rollback, concurrent retry, corrections, immutable ledger, shared meter mapping and CLI authorization',
  );
} finally {
  await cleanup();
  await rm(directory, { recursive: true, force: true });
}
