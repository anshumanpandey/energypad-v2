import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { DriverService } from '../src/server/drivers';
import { AnalysisService } from '../src/server/analysis/service';
import { actorFor } from '../src/server/foundation';
import { snapshotHash, type BaselineDefinition } from '../src/server/analysis/contract';
import type { ReportingInput } from '../src/domain/analysis/reporting';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} },
  url = 'http://localhost:3100';
const sites = new SiteService(db, mail, url),
  energy = new EnergyService(db, mail, url),
  drivers = new DriverService(db, mail, url),
  analysis = new AnalysisService(db, mail, url);
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'analysis@example.test', emailVerified: new Date() } })).id,
  );
  const outsider = actorFor(
    (await db.user.create({ data: { email: 'outsider@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(owner, { name: 'Analysis test', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'A', name: 'Site A' });
  const otherSite = await sites.createSite(owner, org.id, { code: 'B', name: 'Site B' });
  const meter = await sites.saveMeter(owner, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const definition: BaselineDefinition = {
    meterId: meter.id,
    energyUseId: null,
    period: { firstMonth: '2020-01', lastMonth: '2020-04' },
    drivers: ['POPULATION'],
    weather: null,
    fitPolicy: { version: 'experimental-integration', relativeRankTolerance: 1e-10 },
    estimatedConsumption: 'BLOCK',
    supersedesId: null,
  };
  const reading = (month: string, quantity: string) => ({
    meterId: meter.id,
    month,
    quantity,
    estimated: false,
    netCost: null,
    vatPercent: null,
    currency: null,
  });
  const observationIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const month = `2020-0${i}`;
    await energy.add(owner, org.id, site.id, reading(month, String(100 + 2 * i + (i % 2))));
    observationIds.push(
      (
        await drivers.add(owner, org.id, site.id, {
          month,
          driver: 'POPULATION',
          value: String(i),
          source: 'Synthetic test data',
        })
      ).id,
    );
  }
  await assert.rejects(analysis.createBaseline(outsider, org.id, site.id, definition));
  await assert.rejects(analysis.createBaseline(owner, org.id, otherSite.id, definition));
  assert.equal((await analysis.inspectReadiness(owner, org.id, site.id, definition)).ready, true);
  const [first, retry] = await Promise.all([
    analysis.createBaseline(owner, org.id, site.id, definition),
    analysis.createBaseline(owner, org.id, site.id, definition),
  ]);
  assert.equal(first.status, 'SAVED');
  assert.equal(retry.status, 'SAVED');
  if (first.status !== 'SAVED' || retry.status !== 'SAVED') throw Error('Baseline failed');
  assert.equal(first.baseline.id, retry.baseline.id);
  assert.equal((await analysis.readBaseline(owner, org.id, site.id, first.baseline.id)).id, first.baseline.id);
  await assert.rejects(analysis.readBaseline(outsider, org.id, site.id, first.baseline.id));
  await assert.rejects(analysis.readBaseline(owner, org.id, otherSite.id, first.baseline.id));
  assert.equal((await analysis.options(owner, org.id, site.id)).meters[0].id, meter.id);
  await assert.rejects(analysis.options(outsider, org.id, site.id));

  assert.equal(
    await db.auditEvent.count({ where: { targetId: first.baseline.id, action: 'analysis.baseline_created' } }),
    1,
  );
  const policy: ReportingInput['policy'] = {
    version: 'experimental-integration',
    nra: 'NONE',
    significanceBasis: 'POST_NRA',
    comparison: 'AT_LEAST',
    sigmaMultiplier: 2,
    zeroThreshold: 'UNDEFINED',
    negativePrediction: 'BLOCK',
    extrapolation: 'ALLOW_WITH_WARNING',
  };
  const request = { period: { firstMonth: '2020-05', lastMonth: '2020-05' }, policy, references: [] };
  const [run, runRetry] = await Promise.all([
    analysis.run(owner, org.id, site.id, first.baseline.id, request),
    analysis.run(owner, org.id, site.id, first.baseline.id, request),
  ]);
  assert.equal(run.status, 'SAVED');
  assert.equal(runRetry.status, 'SAVED');
  if (run.status !== 'SAVED' || runRetry.status !== 'SAVED') throw Error('Run failed');
  assert.equal(run.run.id, runRetry.run.id);
  assert.ok(run.run.result);
  assert.equal(await db.auditEvent.count({ where: { targetId: run.run.id, action: 'analysis.run_created' } }), 1);
  const saved = await analysis.readRun(owner, org.id, site.id, run.run.id);
  await assert.rejects(analysis.readRun(outsider, org.id, site.id, run.run.id));
  await assert.rejects(analysis.readRun(owner, org.id, otherSite.id, run.run.id));
  for (const role of ['VIEWER', 'SITE_MANAGER'] as const) {
    const actor = actorFor(
      (await db.user.create({ data: { email: `${role}@example.test`, emailVerified: new Date() } })).id,
    );
    const member = await db.membership.create({ data: { organisationId: org.id, userId: actor.userId, role } });
    await assert.rejects(analysis.createBaseline(actor, org.id, site.id, definition));
    if (role === 'SITE_MANAGER') {
      await assert.rejects(analysis.readRun(actor, org.id, site.id, run.run.id));
      await db.siteAssignment.create({ data: { membershipId: member.id, organisationId: org.id, siteId: site.id } });
    }
    assert.equal((await analysis.readRun(actor, org.id, site.id, run.run.id)).id, run.run.id);
    await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
    await assert.rejects(analysis.readRun(actor, org.id, site.id, run.run.id));
  }
  console.log('✓ scoped permissions, assigned-site reads, concurrent reuse and single audit events');
  const analyst = actorFor(
    (await db.user.create({ data: { email: 'analyst@example.test', emailVerified: new Date() } })).id,
  );
  const analystMembership = await db.membership.create({
    data: { organisationId: org.id, userId: analyst.userId, role: 'ANALYST' },
  });
  const analystBaseline = await analysis.createBaseline(analyst, org.id, site.id, {
    ...definition,
    fitPolicy: { ...definition.fitPolicy, version: 'analyst-test' },
  });
  assert.equal(analystBaseline.status, 'SAVED');
  if (analystBaseline.status !== 'SAVED') throw Error('Analyst baseline failed');
  const analystRun = await analysis.run(analyst, org.id, site.id, analystBaseline.baseline.id, {
    ...request,
    policy: { ...policy, nra: 'POPULATION' },
    references: [{ month: '2020-05', referenceMonth: '2020-01' }],
  });
  assert.equal(analystRun.status, 'SAVED');
  if (analystRun.status !== 'SAVED') throw Error('Analyst run failed');
  assert.equal(analystRun.run.authorId, analyst.userId);
  assert.equal(
    await db.auditEvent.count({
      where: { actorUserId: analyst.userId, targetId: { in: [analystBaseline.baseline.id, analystRun.run.id] } },
    }),
    2,
  );
  await assert.rejects(
    sites.updateOrganisation(analyst, org.id, { name: 'Changed', currency: 'GBP', timezone: 'UTC' }),
    { code: 'FORBIDDEN' },
  );
  await assert.rejects(sites.listMembers(analyst, org.id), { code: 'FORBIDDEN' });
  await assert.rejects(energy.add(analyst, org.id, site.id, reading('2020-06', '100')), { code: 'FORBIDDEN' });
  await assert.rejects(analysis.createBaseline(analyst, org.id, otherSite.id, definition), { code: 'NOT_FOUND' });
  await db.membership.update({ where: { id: analystMembership.id }, data: { role: 'VIEWER' } });
  await assert.rejects(analysis.run(analyst, org.id, site.id, analystBaseline.baseline.id, request), {
    code: 'FORBIDDEN',
  });
  await assert.rejects(analysis.createBaseline(analyst, org.id, site.id, definition), { code: 'FORBIDDEN' });
  assert.equal((await analysis.readRun(analyst, org.id, site.id, analystRun.run.id)).id, analystRun.run.id);
  await db.membership.update({ where: { id: analystMembership.id }, data: { revokedAt: new Date() } });
  await assert.rejects(analysis.readRun(analyst, org.id, site.id, analystRun.run.id), { code: 'NOT_FOUND' });
  console.log(
    '✓ Analyst model/NRA writes and auditing, separate admin/source permissions, immediate demotion/revocation',
  );

  const current = await db.consumptionRecord.findFirstOrThrow({
    where: { siteId: site.id, periodStart: new Date('2020-05-01') },
  });
  await energy.correctReading(owner, org.id, site.id, current.id, {
    reading: reading('2020-05', '90'),
    reason: 'Corrected test reading',
    useLatestConversion: false,
  });
  const corrected = await analysis.run(owner, org.id, site.id, first.baseline.id, request);
  assert.equal(corrected.status, 'SAVED');
  if (corrected.status !== 'SAVED') throw Error('Correction failed');
  assert.notEqual(corrected.run.id, run.run.id);
  assert.notEqual(corrected.run.inputHash, run.run.inputHash);
  assert.deepEqual(await analysis.readRun(owner, org.id, site.id, run.run.id), saved);
  // Baseline observations are frozen: changing current source revisions must not alter an old baseline's NRA inputs.
  const nraRequest = {
    ...request,
    policy: { ...policy, nra: 'POPULATION' },
    references: [{ month: '2020-05', referenceMonth: '2020-01' }],
  };
  const nraRun = await analysis.run(owner, org.id, site.id, first.baseline.id, nraRequest);
  assert.equal(nraRun.status, 'SAVED');
  await drivers.correctObservation(owner, org.id, site.id, observationIds[0], {
    observation: { month: '2020-01', driver: 'POPULATION', value: '10', source: 'Corrected test value' },
    reason: 'Correction test',
  });
  const sameNra = await analysis.run(owner, org.id, site.id, first.baseline.id, nraRequest);
  assert.equal(sameNra.status, 'SAVED');
  if (nraRun.status !== 'SAVED' || sameNra.status !== 'SAVED') throw Error('NRA failed');
  assert.equal(nraRun.run.id, sameNra.run.id);
  const revised = await analysis.createBaseline(owner, org.id, site.id, {
    ...definition,
    supersedesId: first.baseline.id,
  });
  assert.equal(revised.status, 'SAVED');
  if (revised.status !== 'SAVED') throw Error('Revision failed');
  assert.equal(revised.baseline.revision, 2);
  assert.equal(
    (await analysis.createBaseline(owner, org.id, site.id, { ...definition, supersedesId: first.baseline.id })).status,
    'SAVED',
  );
  await assert.rejects(
    analysis.createBaseline(owner, org.id, site.id, {
      ...definition,
      supersedesId: first.baseline.id,
      fitPolicy: { ...definition.fitPolicy, version: 'changed' },
    }),
  );
  console.log('✓ source corrections create new runs, old evidence/results stay frozen, explicit baseline revisions');
  const missing = await analysis.run(owner, org.id, site.id, first.baseline.id, {
    ...request,
    period: { firstMonth: '2020-06', lastMonth: '2020-06' },
  });
  assert.equal(missing.status, 'BLOCKED');
  const baselineCount = await db.baselineVersion.count();
  const bad = await analysis.createBaseline(owner, org.id, site.id, {
    ...definition,
    period: { firstMonth: '2020-06', lastMonth: '2020-09' },
  });
  assert.equal(bad.status, 'BLOCKED');
  assert.equal(await db.baselineVersion.count(), baselineCount);
  await assert.rejects(
    db.baselineVersion.update({ where: { id: first.baseline.id }, data: { inputHash: 'a'.repeat(64) } }),
  );
  await assert.rejects(db.analysisRun.delete({ where: { id: run.run.id } }));
  await assert.rejects(db.analysisResult.update({ where: { id: run.run.result!.id }, data: { output: {} } }));
  for (const table of ['BaselineVersion', 'AnalysisRun', 'AnalysisResult'])
    await assert.rejects(db.$executeRawUnsafe(`TRUNCATE "${table}" CASCADE`));
  await assert.rejects(
    db.analysisRun.create({
      data: {
        ...run.run,
        result: undefined,
        id: crypto.randomUUID(),
        siteId: otherSite.id,
        inputHash: 'b'.repeat(64),
        snapshot: {},
      },
    }),
  );
  const config = await db.weatherConfiguration.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      version: 1,
      latitude: '1',
      longitude: '1',
      timezone: 'UTC',
      heatingBase: '15.5',
      coolingBase: '18',
      source: 'Synthetic weather',
      authorId: owner.userId,
    },
  });
  const weatherDefinition = {
    ...definition,
    drivers: ['HDD'],
    weather: { configurationId: config.id, methodology: 'daily-mean-degree-days-v1' },
  };
  assert.equal((await analysis.inspectReadiness(owner, org.id, site.id, weatherDefinition)).ready, false);
  await db.weatherYear.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      configurationId: config.id,
      year: 2020,
      methodology: 'daily-mean-degree-days-v1',
      provenance: { synthetic: true },
      daily: [],
      inputHash: 'test-weather-hash',
      authorId: owner.userId,
      monthly: [1, 2, 3, 4, 5].map((m, i) => ({
        month: `2020-0${m}`,
        days: [31, 29, 31, 30, 31][i],
        heatingDegreeDays: m * 2,
        coolingDegreeDays: 0,
        daylightHours: 100,
      })),
    },
  });
  const weatherBaseline = await analysis.createBaseline(owner, org.id, site.id, weatherDefinition);
  assert.equal(weatherBaseline.status, 'SAVED');
  if (weatherBaseline.status !== 'SAVED') throw Error('Weather baseline failed');
  assert.equal((await analysis.run(owner, org.id, site.id, weatherBaseline.baseline.id, request)).status, 'SAVED');
  const short = await analysis.inspectReadiness(owner, org.id, site.id, {
    ...definition,
    period: { firstMonth: '2020-01', lastMonth: '2020-01' },
  });
  assert.equal(short.ready, false);
  const estimated = await energy.add(owner, org.id, site.id, { ...reading('2020-06', '120'), estimated: true });
  await drivers.add(owner, org.id, site.id, {
    month: '2020-06',
    driver: 'POPULATION',
    value: '6',
    source: 'Test observation',
  });
  const estimatedRequest = { ...request, period: { firstMonth: '2020-06', lastMonth: '2020-06' } };
  const blockedEstimate = await analysis.run(owner, org.id, site.id, first.baseline.id, estimatedRequest);
  assert.equal(blockedEstimate.status, 'BLOCKED');
  const allowedBaseline = await analysis.createBaseline(owner, org.id, site.id, {
    ...definition,
    estimatedConsumption: 'ALLOW_WITH_WARNING',
  });
  if (allowedBaseline.status !== 'SAVED') throw Error('Estimated policy baseline failed');
  const allowedRun = await analysis.run(owner, org.id, site.id, allowedBaseline.baseline.id, estimatedRequest);
  assert.equal(allowedRun.status, 'SAVED');
  assert.ok(JSON.stringify(allowedRun).includes('ESTIMATED_CONSUMPTION'));
  // Database uniqueness prevents a second original reading for the same meter/month.
  await assert.rejects(
    db.consumptionRecord.create({
      data: {
        ...estimated,
        id: crypto.randomUUID(),
        attributeSnapshot: {},
        qualityFlags: [],
        energyUseSnapshot: undefined,
        sourceProvenance: undefined,
      },
    }),
  );
  const beforeRollback = {
    runs: await db.analysisRun.count(),
    results: await db.analysisResult.count(),
    baselines: await db.baselineVersion.count(),
  };
  await assert.rejects(
    analysis.run({ ...owner, correlationId: 'invalid-uuid' }, org.id, site.id, first.baseline.id, {
      ...request,
      policy: { ...policy, version: 'rollback' },
    }),
  );
  await assert.rejects(
    analysis.createBaseline({ ...owner, correlationId: 'invalid-uuid' }, org.id, site.id, {
      ...definition,
      fitPolicy: { ...definition.fitPolicy, version: 'rollback' },
    }),
  );
  assert.deepEqual(
    {
      runs: await db.analysisRun.count(),
      results: await db.analysisResult.count(),
      baselines: await db.baselineVersion.count(),
    },
    beforeRollback,
  );
  console.log(
    '✓ pinned weather versions, missing weather, insufficient fit data, estimated policy, duplicate prevention and audit-failure rollback',
  );
  console.log('✓ missing inputs block persistence, composite scope constraints and database immutability');
  // Dense tied timestamps and more than the old 100-entry cap exercise keyset pagination.
  const oldDate = new Date('2001-01-01T00:00:00Z');
  const baseRows = Array.from({ length: 105 }, (_, i) => ({
    ...first.baseline,
    id: crypto.randomUUID(),
    createdAt: oldDate,
    inputHash: snapshotHash({ paginationBaseline: i }),
    snapshot: JSON.parse(JSON.stringify(first.baseline.snapshot)),
    fit: JSON.parse(JSON.stringify(first.baseline.fit)),
  }));
  await db.baselineVersion.createMany({ data: baseRows });
  const runRows = Array.from({ length: 105 }, (_, i) => ({
    id: crypto.randomUUID(),
    organisationId: org.id,
    siteId: site.id,
    meterId: meter.id,
    baselineId: first.baseline.id,
    inputHash: snapshotHash({ paginationRun: i }),
    snapshot: {},
    authorId: owner.userId,
    createdAt: oldDate,
  }));
  await db.analysisRun.createMany({ data: runRows });
  await db.analysisResult.createMany({
    data: runRows.map((r) => ({ organisationId: org.id, siteId: site.id, meterId: meter.id, runId: r.id, output: {} })),
  });
  const expectedBaselines = await db.baselineVersion.findMany({
    where: { organisationId: org.id, siteId: site.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  let baselinePage = await analysis.history(owner, org.id, site.id, { limit: 17 });
  const baselineIds = baselinePage.items.map((b) => b.id);
  assert.ok(baselinePage.nextCursor);
  // A new newest item must not shift or duplicate entries in an ongoing traversal.
  await db.baselineVersion.create({
    data: {
      ...baseRows[0],
      id: crypto.randomUUID(),
      createdAt: new Date(),
      inputHash: snapshotHash({ newerDuringPagination: true }),
    },
  });
  while (baselinePage.nextCursor) {
    baselinePage = await analysis.history(owner, org.id, site.id, { cursor: baselinePage.nextCursor, limit: 17 });
    baselineIds.push(...baselinePage.items.map((b) => b.id));
  }
  assert.deepEqual(
    baselineIds,
    expectedBaselines.map((b) => b.id),
  );
  assert.equal(new Set(baselineIds).size, baselineIds.length);
  const expectedRuns = await db.analysisRun.findMany({
    where: { baselineId: first.baseline.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  let runPage = await analysis.runHistory(owner, org.id, site.id, first.baseline.id, { limit: 13 });
  const runIds = runPage.items.map((r) => r.id);
  while (runPage.nextCursor) {
    runPage = await analysis.runHistory(owner, org.id, site.id, first.baseline.id, {
      cursor: runPage.nextCursor,
      limit: 13,
    });
    runIds.push(...runPage.items.map((r) => r.id));
  }
  assert.deepEqual(
    runIds,
    expectedRuns.map((r) => r.id),
  );
  const summary = (await analysis.history(owner, org.id, site.id, { limit: 100 })).items.find(
    (b) => b.id === first.baseline.id,
  )!;
  assert.equal(summary.runs.length, 100);
  assert.equal(summary.nextRunCursor, summary.runs[99].id);
  await assert.rejects(analysis.history(owner, org.id, otherSite.id, { cursor: first.baseline.id }));
  await assert.rejects(analysis.history(outsider, org.id, site.id, { cursor: first.baseline.id }));
  await assert.rejects(analysis.history(owner, org.id, site.id, { cursor: crypto.randomUUID() }));
  await assert.rejects(
    analysis.runHistory(owner, org.id, site.id, weatherBaseline.baseline.id, { cursor: run.run.id }),
  );
  await assert.rejects(analysis.runHistory(owner, org.id, otherSite.id, first.baseline.id, {}));
  await assert.rejects(analysis.runHistory(outsider, org.id, site.id, first.baseline.id, {}));
  await assert.rejects(analysis.runHistory(owner, org.id, site.id, first.baseline.id, { limit: 101 }));
  console.log('✓ complete history beyond 100 entries, timestamp ties, concurrent insert stability and scoped cursors');
} finally {
  await cleanup();
}
