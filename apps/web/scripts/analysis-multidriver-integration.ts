import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { seedMultidriver } from './fixtures/analysis-multidriver';
import { AnalysisService } from '../src/server/analysis/service';
import type { RegressionResult } from '../src/domain/analysis/regression';
const { db, cleanup } = await testDatabase();
try {
  const f = await seedMultidriver(db);
  const service = new AnalysisService(db, { async send() {} }, 'http://localhost:3101');
  const base = {
    energyUseId: null,
    period: { firstMonth: '2020-01', lastMonth: '2020-08' },
    weather: { configurationId: f.configurationId, methodology: 'daily-mean-degree-days-v1' },
    fitPolicy: { version: 'multidriver-test', relativeRankTolerance: 1e-10 },
    estimatedConsumption: 'BLOCK',
    supersedesId: null,
  };
  for (const scenario of [
    { meterId: f.twoId, drivers: ['HDD', 'CDD'], slopes: [2, 3], expected: 185 },
    { meterId: f.threeId, drivers: ['HDD', 'CDD', 'DAYLIGHT'], slopes: [2, 3, 4], expected: 309 },
    { meterId: f.threeId, drivers: ['DAYLIGHT', 'CDD', 'HDD'], slopes: [4, 3, 2], expected: 309 },
    { meterId: f.threeId, drivers: ['POPULATION', 'HDD', 'CDD'], slopes: [4, 2, 3], expected: 309 },
  ]) {
    const definition = { ...base, meterId: scenario.meterId, drivers: scenario.drivers };
    assert.equal((await service.inspectReadiness(f.owner, f.orgId, f.siteId, definition)).ready, true);
    const result = await service.createBaseline(f.owner, f.orgId, f.siteId, definition);
    if (result.status !== 'SAVED') throw Error('Baseline blocked');
    const baseline = await service.readBaseline(f.owner, f.orgId, f.siteId, result.baseline.id);
    const fit = baseline.fit as unknown as Extract<RegressionResult, { status: 'FITTED' }>;
    assert.equal(fit.status, 'FITTED');
    assert.ok(Math.abs(fit.intercept - 100) < 1e-9);
    assert.deepEqual(
      fit.coefficients.map((c) => c.code),
      scenario.drivers,
    );
    fit.coefficients.forEach((c, i) => assert.ok(Math.abs(c.value - scenario.slopes[i]) < 1e-9));
    assert.ok(Math.abs(fit.ssResidual - 2) < 1e-9);
    const snapshot = baseline.snapshot as unknown as {
      assembly: {
        rows: { drivers: { code: string; value: number }[] }[];
        evidence: { weather: { id: string; configurationId: string; inputHash: string }[] };
      };
    };
    for (const row of snapshot.assembly.rows)
      assert.deepEqual(
        row.drivers.map((d) => d.code),
        scenario.drivers,
      );
    assert.equal(snapshot.assembly.evidence.weather[0].id, f.weatherId);
    assert.equal(snapshot.assembly.evidence.weather[0].configurationId, f.configurationId);
    assert.equal(snapshot.assembly.evidence.weather[0].inputHash, 'synthetic-pinned-v1');
    const request = {
      period: { firstMonth: '2020-09', lastMonth: '2020-09' },
      policy: {
        version: 'multidriver-test',
        nra: 'NONE',
        significanceBasis: 'POST_NRA',
        comparison: 'AT_LEAST',
        sigmaMultiplier: 2,
        zeroThreshold: 'UNDEFINED',
        negativePrediction: 'BLOCK',
        extrapolation: 'BLOCK',
      },
      references: [],
    };
    const run = await service.run(f.owner, f.orgId, f.siteId, baseline.id, request);
    if (run.status !== 'SAVED') throw Error('Run blocked');
    const saved = await service.readRun(f.owner, f.orgId, f.siteId, run.run.id);
    const output = saved.result!.output as unknown as { rows: { expectedKwh: number; postNraVarianceKwh: number }[] };
    assert.ok(Math.abs(output.rows[0].expectedKwh - scenario.expected) < 1e-9);
    assert.ok(Math.abs(output.rows[0].postNraVarianceKwh - 5) < 1e-9);
    assert.deepEqual(saved.baseline.fit, baseline.fit);
    assert.deepEqual(await service.readRun(f.owner, f.orgId, f.siteId, saved.id), saved);
    const before = await db.analysisRun.count();
    const missing = await service.run(f.owner, f.orgId, f.siteId, baseline.id, {
      ...request,
      period: { firstMonth: '2020-10', lastMonth: '2020-10' },
    });
    assert.equal(missing.status, 'BLOCKED');
    if (missing.status === 'BLOCKED') assert.ok(missing.issues.some((i) => i.code === 'MISSING_WEATHER'));
    assert.equal(await db.analysisRun.count(), before);
  }
  const count = await db.baselineVersion.count();
  const blocked = await service.createBaseline(f.owner, f.orgId, f.siteId, {
    ...base,
    meterId: f.threeId,
    drivers: ['HDD', 'OPERATING_HOURS'],
  });
  assert.equal(blocked.status, 'BLOCKED');
  if (blocked.status === 'BLOCKED') assert.ok(blocked.issues.some((i) => i.code === 'MISSING_DRIVER'));
  assert.equal(await db.baselineVersion.count(), count);
  console.log(
    '✓ persisted 2/3 weather drivers, reordered/mixed drivers, pinned provenance, known predictions, reload and missing-input atomicity',
  );
} finally {
  await cleanup();
}
