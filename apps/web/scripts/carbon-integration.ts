import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { EmissionFactorService } from '../src/server/emission-factors';
import { CarbonTargetService } from '../src/server/carbon-targets';
import { CarbonService } from '../src/server/carbon';
import type { CarbonSnapshot } from '../src/domain/carbon';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const sites = new SiteService(...args),
  energy = new EnergyService(...args),
  factors = new EmissionFactorService(...args),
  carbon = new CarbonService(...args);
const targets = new CarbonTargetService(...args);
const snapshot = (run: { snapshot: unknown }) => run.snapshot as CarbonSnapshot;
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'carbon@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'carbon-other@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Carbon', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'C', name: 'Carbon site' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const definition = {
    meterId: meter.id,
    year: 2020,
    geography: 'gb',
    basis: 'LOCATION_BASED',
    requestKey: randomUUID(),
  };
  const summaryDefinition = { year: 2020, geography: 'gb', basis: 'LOCATION_BASED' };
  const getSummary = () => carbon.summary(actor, org.id, site.id, summaryDefinition);
  await assert.rejects(() => carbon.overview(stranger, org.id, site.id, summaryDefinition));
  const missingOverview = await carbon.overview(actor, org.id, site.id, summaryDefinition);
  assert.equal(missingOverview.energy.kwh, null);
  assert.equal(missingOverview.energy.completeMonths, 0);
  const missingSummary = await getSummary();
  assert.equal(missingSummary.status, 'INCOMPLETE');
  assert.equal(missingSummary.meters[0].status, 'MISSING');
  assert.equal(missingSummary.totalKgCO2e, null);
  const emptySite = await sites.createSite(actor, org.id, { code: 'EMPTY', name: 'Empty' });
  const emptySummary = await carbon.summary(actor, org.id, emptySite.id, summaryDefinition);
  assert.equal(emptySummary.status, 'EMPTY');
  assert.equal((await carbon.overview(actor, org.id, emptySite.id, summaryDefinition)).energy.kwh, null);

  assert.equal(emptySummary.totalKgCO2e, null);
  const empty = await carbon.calculate(actor, org.id, site.id, definition);
  assert.equal(snapshot(empty).status, 'BLOCKED');
  assert.equal(snapshot(empty).totalKgCO2e, null);
  assert.equal(snapshot(empty).rows.length, 12);
  for (let month = 1; month <= 12; month++)
    await energy.add(actor, org.id, site.id, {
      meterId: meter.id,
      month: `2020-${String(month).padStart(2, '0')}`,
      quantity: '100',
      estimated: month === 2,
    });
  const filledOverview = await carbon.overview(actor, org.id, site.id, summaryDefinition);
  assert.equal(filledOverview.energy.kwh, '1200');
  const benchmark = await carbon.benchmark(actor, org.id, summaryDefinition);
  assert.equal(benchmark.rows[0].id, site.id);
  assert.equal(benchmark.rows[0].rank, 1);
  assert.equal(benchmark.rows[0].kwh, '1200');
  assert.equal(benchmark.rows.find((s) => s.id === emptySite.id)!.rank, null);
  assert.ok(
    (await carbon.benchmark(actor, org.id, { ...summaryDefinition, metric: 'netCost' })).rows.every(
      (s) => s.rank === null,
    ),
  );
  assert.equal((await carbon.benchmark(actor, org.id, { ...summaryDefinition, month: 2 })).rows[0].kwh, '100');
  assert.ok(
    (await carbon.benchmark(actor, org.id, { ...summaryDefinition, fuel: 'GAS' })).rows.every((s) => s.rank === null),
  );
  await assert.rejects(carbon.benchmark(stranger, org.id, summaryDefinition));

  assert.equal(filledOverview.energy.netCost, null);
  assert.equal(filledOverview.energy.months[1].estimated, 1);
  const noFactors = await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: randomUUID() });
  assert.equal(snapshot(noFactors).status, 'BLOCKED');
  assert.equal(snapshot(noFactors).totalKgCO2e, null);
  const factor = {
    fuel: 'ELECTRICITY',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.1',
    source: 'Synthetic carbon test',
    firstDay: '2020-01-01',
    lastDay: '2020-06-30',
  };
  const firstFactor = await factors.add(actor, org.id, factor);
  await factors.add(actor, org.id, { ...factor, firstDay: '2020-07-01', lastDay: '2020-12-31', factor: '0.2' });
  const key = randomUUID();
  const complete = await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: key });
  assert.equal(snapshot(complete).totalKgCO2e, '180');
  const targetInput = {
    ...definition,
    requestKey: randomUUID(),
    name: 'Annual limit',
    limitKgCO2e: '180',
    source: 'Synthetic test target',
  };
  const target = await targets.add(actor, org.id, site.id, targetInput);
  assert.equal((await targets.add(actor, org.id, site.id, targetInput)).id, target.id);
  await assert.rejects(targets.add(actor, org.id, site.id, { ...targetInput, name: 'Conflicting retry' }));
  await assert.rejects(targets.add(actor, org.id, site.id, { ...targetInput, requestKey: randomUUID() }));
  await assert.rejects(targets.add(actor, org.id, site.id, { ...targetInput, limitKgCO2e: '-1' }));
  await assert.rejects(targets.add(actor, org.id, emptySite.id, { ...targetInput, requestKey: randomUUID() }));
  await assert.rejects(targets.assess(actor, org.id, site.id, target.id, { runId: empty.id }));
  const assessments = await Promise.all([
    targets.assess(actor, org.id, site.id, target.id, { runId: complete.id }),
    targets.assess(actor, org.id, site.id, target.id, { runId: complete.id }),
  ]);
  assert.equal(assessments[0].id, assessments[1].id);
  assert.equal(assessments[0].status, 'MET');
  assert.equal(assessments[0].varianceKgCO2e, '0');
  const targetComparison = (await carbon.benchmark(actor, org.id, summaryDefinition)).rows.find(
    (s) => s.id === site.id,
  )!;
  assert.equal(targetComparison.targetStatus, 'MET');
  assert.equal(targetComparison.carbonGap, '0');
  assert.equal(targetComparison.targets[0].id, target.id);
  assert.equal((await carbon.benchmark(actor, org.id, { ...summaryDefinition, month: 1 })).rows[0].target, null);

  const correction = {
    target: { ...targetInput, requestKey: randomUUID(), limitKgCO2e: '100.000000000001' },
    reason: 'Tighten synthetic target',
  };
  const correctedTarget = await targets.correct(actor, org.id, site.id, target.id, correction);
  assert.equal((await targets.correct(actor, org.id, site.id, target.id, correction)).id, correctedTarget.id);
  await assert.rejects(
    targets.correct(actor, org.id, site.id, target.id, {
      ...correction,
      target: { ...correction.target, requestKey: randomUUID() },
    }),
  );
  await assert.rejects(
    targets.correct(actor, org.id, site.id, correctedTarget.id, {
      ...correction,
      target: { ...correction.target, year: 2021, requestKey: randomUUID() },
    }),
  );
  const exceeded = await targets.assess(actor, org.id, site.id, correctedTarget.id, { runId: complete.id });
  assert.equal(exceeded.status, 'EXCEEDED');
  assert.equal(
    (await carbon.benchmark(actor, org.id, summaryDefinition)).rows.find((s) => s.id === site.id)!.targetStatus,
    'EXCEEDED',
  );

  assert.equal(exceeded.varianceKgCO2e, '79.999999999999');
  assert.equal(
    (await targets.list(actor, org.id, site.id)).find((t) => t.id === target.id)!.assessments[0].status,
    'MET',
  );
  const otherYearTarget = await targets.add(actor, org.id, site.id, {
    ...targetInput,
    year: 2021,
    requestKey: randomUUID(),
  });
  await assert.rejects(targets.assess(actor, org.id, site.id, otherYearTarget.id, { runId: complete.id }));
  await assert.rejects(targets.list(stranger, org.id, site.id));
  await assert.rejects(targets.assess(stranger, org.id, site.id, correctedTarget.id, { runId: complete.id }));
  await assert.rejects(db.carbonTargetVersion.update({ where: { id: target.id }, data: { name: 'Mutate' } }));
  await assert.rejects(db.carbonTargetAssessment.delete({ where: { id: exceeded.id } }));
  assert.equal(
    await db.auditEvent.count({ where: { targetId: assessments[0].id, action: 'carbon.target_assessed' } }),
    1,
  );

  const readySummary = await getSummary();
  assert.equal(readySummary.totalKgCO2e, '180');
  const trendDefinition = { ...summaryDefinition, comparisonYear: 2019, kind: 'site', id: site.id };
  const trend = await carbon.trends(actor, org.id, trendDefinition);
  assert.equal(trend.series[1].totalKgCO2e, '180');
  assert.equal(trend.series[0].totalKgCO2e, null);
  assert.equal(trend.series[1].months[0].kgCO2e, '10');
  assert.equal(trend.series[1].months[1].estimated, 1);
  assert.equal(trend.change.difference, null);
  await assert.rejects(carbon.trends(stranger, org.id, trendDefinition));
  assert.equal(
    (await carbon.trends(actor, org.id, { ...trendDefinition, geography: 'US' })).series[1].totalKgCO2e,
    null,
  );

  assert.equal(readySummary.meters[0].estimatedMonths, 1);
  assert.equal(readySummary.meters[0].runId, complete.id);
  assert.equal(
    (await carbon.summary(actor, org.id, site.id, { ...summaryDefinition, geography: 'US' })).meters[0].status,
    'MISSING',
  );
  assert.equal(snapshot(complete).status, 'COMPLETE');
  assert.equal(snapshot(complete).rows[1].estimated, true);
  assert.equal(snapshot(complete).rows[0].factorId, firstFactor.id);
  assert.equal((await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: key })).id, complete.id);
  await assert.rejects(carbon.calculate(actor, org.id, site.id, { ...definition, year: 2021, requestKey: key }));
  await factors.correct(actor, org.id, firstFactor.id, {
    factor: { ...factor, factor: '0.3' },
    reason: 'Correct synthetic value',
  });
  assert.equal((await getSummary()).meters[0].status, 'OUTDATED');
  assert.equal((await getSummary()).totalKgCO2e, null);
  const staleTrend = await carbon.trends(actor, org.id, trendDefinition);
  assert.equal(staleTrend.series[1].months[0].kgCO2e, null);
  assert.equal(staleTrend.series[1].months[6].kgCO2e, '20');
  assert.equal(staleTrend.series[1].sites[0].months[0].meters[0].status, 'OUTDATED');
  const revised = await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: randomUUID() });
  assert.equal(snapshot(revised).totalKgCO2e, '300');
  assert.equal(
    snapshot((await carbon.history(actor, org.id, site.id)).find((r) => r.id === complete.id)!).totalKgCO2e,
    '180',
  );
  assert.equal((await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: key })).id, complete.id);
  await energy.correctReading(actor, org.id, site.id, snapshot(complete).rows[0].readingId!, {
    reading: { meterId: meter.id, month: '2020-01', quantity: '200' },
    reason: 'Correct synthetic consumption',
    useLatestConversion: false,
  });
  assert.equal((await getSummary()).meters[0].status, 'OUTDATED');
  const newReading = await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: randomUUID() });
  assert.equal(snapshot(newReading).totalKgCO2e, '330');
  assert.equal((await getSummary()).totalKgCO2e, '330');
  assert.equal(snapshot(newReading).rows[0].readingRevision, 2);
  const portfolio = await sites.savePortfolio(actor, org.id, { name: 'Carbon portfolio' });
  const otherPortfolio = await sites.savePortfolio(actor, org.id, { name: 'Other portfolio' });
  await db.site.update({ where: { id: site.id }, data: { portfolioId: portfolio.id } });
  const portfolioSummary = () => carbon.portfolioSummary(actor, org.id, portfolio.id, summaryDefinition);
  assert.equal((await portfolioSummary()).totalKgCO2e, '330');
  assert.equal((await portfolioSummary()).sites[0].summary.meters[0].runId, newReading.id);
  const noSites = await carbon.portfolioSummary(actor, org.id, otherPortfolio.id, summaryDefinition);
  assert.equal(noSites.status, 'EMPTY');
  assert.equal(noSites.totalKgCO2e, null);
  const additionalSite = await sites.createSite(actor, org.id, {
    code: 'SECOND',
    name: 'Second carbon site',
    portfolioId: portfolio.id,
  });
  assert.equal((await portfolioSummary()).status, 'INCOMPLETE');
  assert.equal((await portfolioSummary()).totalKgCO2e, null);
  const additionalMeter = await sites.saveMeter(actor, org.id, additionalSite.id, {
    code: 'E',
    name: 'Second site meter',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  assert.equal(
    (await portfolioSummary()).sites.find((s) => s.id === additionalSite.id)!.summary.meters[0].status,
    'MISSING',
  );
  for (let month = 1; month <= 12; month++)
    await energy.add(actor, org.id, additionalSite.id, {
      meterId: additionalMeter.id,
      month: `2020-${String(month).padStart(2, '0')}`,
      quantity: '0.001',
    });
  await carbon.calculate(actor, org.id, additionalSite.id, {
    ...definition,
    meterId: additionalMeter.id,
    requestKey: randomUUID(),
  });
  const multiSite = await portfolioSummary();
  assert.equal(multiSite.totalKgCO2e, '330.003');
  const portfolioReport = await carbon.report(actor, org.id, 'portfolio', portfolio.id, summaryDefinition);
  assert.equal(portfolioReport.reportVersion, 'carbon-report-v1');
  assert.equal(portfolioReport.totalKgCO2e, '330.003');
  assert.equal(portfolioReport.evidence.length, 2);
  assert.ok(portfolioReport.evidence.every((r) => r.algorithmVersion === 'monthly-exact-factor-v1'));
  const siteReport = await carbon.report(actor, org.id, 'site', site.id, summaryDefinition);
  assert.equal(siteReport.evidence.length, 1);
  assert.equal(siteReport.evidence[0].id, newReading.id);
  assert.equal(siteReport.evidence[0].snapshot.rows[0].readingRevision, 2);
  await assert.rejects(carbon.report(stranger, org.id, 'portfolio', portfolio.id, summaryDefinition));
  assert.ok(multiSite.sites.every((s) => s.summary.checkedAt === multiSite.checkedAt));
  await db.site.update({ where: { id: additionalSite.id }, data: { archivedAt: new Date() } });
  assert.equal((await portfolioSummary()).totalKgCO2e, '330');
  await db.site.update({
    where: { id: additionalSite.id },
    data: { archivedAt: null, portfolioId: otherPortfolio.id },
  });
  assert.equal((await portfolioSummary()).sites.length, 1);
  await db.site.update({ where: { id: additionalSite.id }, data: { portfolioId: portfolio.id } });
  await assert.rejects(carbon.portfolioSummary(stranger, org.id, portfolio.id, summaryDefinition));

  assert.equal(
    snapshot((await carbon.history(actor, org.id, site.id)).find((r) => r.id === complete.id)!).rows[0].normalizedKwh,
    '100',
  );
  await factors.add(actor, org.id, { ...factor, basis: 'MARKET_BASED', lastDay: '2020-01-15' });
  await factors.add(actor, org.id, { ...factor, basis: 'MARKET_BASED', firstDay: '2020-01-16', lastDay: '2020-12-31' });
  const midmonth = await carbon.calculate(actor, org.id, site.id, {
    ...definition,
    basis: 'MARKET_BASED',
    requestKey: randomUUID(),
  });
  assert.equal(snapshot(midmonth).status, 'BLOCKED');
  assert.match(snapshot(midmonth).rows[0].issue!, /whole month/);
  await assert.rejects(carbon.overview(stranger, org.id, site.id, summaryDefinition));
  await assert.rejects(carbon.history(stranger, org.id, site.id));
  await assert.rejects(carbon.summary(stranger, org.id, site.id, summaryDefinition));
  await assert.rejects(targets.list(stranger, org.id, site.id));
  await db.membership.create({ data: { organisationId: org.id, userId: stranger.userId, role: 'VIEWER' } });
  assert.ok((await carbon.history(stranger, org.id, site.id)).length);
  assert.ok((await targets.list(stranger, org.id, site.id)).length);
  assert.equal(
    (await carbon.portfolioSummary(stranger, org.id, portfolio.id, summaryDefinition)).totalKgCO2e,
    '330.003',
  );
  await assert.rejects(
    targets.add(stranger, org.id, site.id, { ...targetInput, year: 2022, requestKey: randomUUID() }),
  );
  await assert.rejects(targets.assess(stranger, org.id, site.id, correctedTarget.id, { runId: complete.id }));
  assert.equal((await carbon.summary(stranger, org.id, site.id, summaryDefinition)).totalKgCO2e, '330');
  await assert.rejects(carbon.calculate(stranger, org.id, site.id, { ...definition, requestKey: randomUUID() }));
  await db.membership.update({
    where: { organisationId_userId: { organisationId: org.id, userId: stranger.userId } },
    data: { role: 'SITE_MANAGER' },
  });
  await assert.rejects(carbon.overview(stranger, org.id, site.id, summaryDefinition));
  await assert.rejects(carbon.history(stranger, org.id, site.id));
  await assert.rejects(carbon.summary(stranger, org.id, site.id, summaryDefinition));
  await assert.rejects(targets.list(stranger, org.id, site.id));
  await assert.rejects(db.carbonRun.update({ where: { id: complete.id }, data: { algorithmVersion: 'altered' } }));
  await assert.rejects(db.carbonRun.delete({ where: { id: complete.id } }));
  assert.equal(await db.auditEvent.count({ where: { targetId: complete.id, action: 'carbon.calculated' } }), 1);
  const secondMeter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E2',
    name: 'Second meter',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  assert.equal((await getSummary()).totalKgCO2e, null);
  assert.equal((await getSummary()).meters.find((m) => m.meterId === secondMeter.id)!.status, 'MISSING');
  for (let month = 1; month <= 12; month++)
    await energy.add(actor, org.id, site.id, {
      meterId: secondMeter.id,
      month: `2020-${String(month).padStart(2, '0')}`,
      quantity: '0.001',
    });
  await carbon.calculate(actor, org.id, site.id, { ...definition, meterId: secondMeter.id, requestKey: randomUUID() });
  assert.equal((await getSummary()).totalKgCO2e, '330.003');
  await db.meter.update({ where: { id: secondMeter.id }, data: { archivedAt: new Date() } });
  assert.equal((await getSummary()).totalKgCO2e, '330');
  const currentFactor = (await factors.list(actor, org.id)).find((f) => f.supersedesId === firstFactor.id)!;
  await factors.correct(actor, org.id, currentFactor.id, {
    factor: { ...factor, lastDay: '2020-01-31' },
    reason: 'Shorten synthetic coverage',
  });
  const blockedLatest = await carbon.calculate(actor, org.id, site.id, { ...definition, requestKey: randomUUID() });
  assert.equal((await getSummary()).meters[0].status, 'BLOCKED');
  assert.equal((await getSummary()).meters[0].runId, blockedLatest.id);
  assert.equal((await getSummary()).totalKgCO2e, null);
  assert.equal((await portfolioSummary()).totalKgCO2e, null);
  await assert.rejects(carbon.portfolioSummary(stranger, org.id, portfolio.id, summaryDefinition));
  const managerMembership = await db.membership.findUniqueOrThrow({
    where: { organisationId_userId: { organisationId: org.id, userId: stranger.userId } },
  });
  await db.siteAssignment.create({
    data: { membershipId: managerMembership.id, organisationId: org.id, siteId: additionalSite.id },
  });
  const assignedSummary = await carbon.portfolioSummary(stranger, org.id, portfolio.id, summaryDefinition);
  assert.equal(assignedSummary.scope, 'ASSIGNED_ACTIVE_SITES');
  assert.deepEqual(
    assignedSummary.sites.map((s) => s.id),
    [additionalSite.id],
  );
  assert.ok(!JSON.stringify(assignedSummary).includes(site.name));
  const assignedTrends = await carbon.trends(stranger, org.id, {
    ...trendDefinition,
    kind: 'portfolio',
    id: portfolio.id,
  });
  assert.deepEqual(
    assignedTrends.series[1].sites.map((s) => s.id),
    [additionalSite.id],
  );
  assert.ok(!JSON.stringify(assignedTrends).includes(site.name));
  await assert.rejects(carbon.trends(stranger, org.id, trendDefinition));
  await assert.rejects(
    carbon.trends(stranger, org.id, { ...trendDefinition, kind: 'portfolio', id: otherPortfolio.id }),
  );

  const scopedBenchmark = await carbon.benchmark(stranger, org.id, summaryDefinition);
  assert.deepEqual(
    scopedBenchmark.available.map((s) => s.id),
    [additionalSite.id],
  );
  assert.deepEqual(
    scopedBenchmark.rows.map((s) => s.id),
    [additionalSite.id],
  );
  assert.ok(!JSON.stringify(scopedBenchmark).includes(site.name));
  await assert.rejects(carbon.benchmark(stranger, org.id, { ...summaryDefinition, siteId: site.id }));
  await db.site.update({ where: { id: additionalSite.id }, data: { archivedAt: new Date() } });
  assert.equal((await carbon.benchmark(stranger, org.id, summaryDefinition)).rows.length, 0);
  await db.site.update({ where: { id: additionalSite.id }, data: { archivedAt: null } });

  await assert.rejects(carbon.portfolioSummary(stranger, org.id, otherPortfolio.id, summaryDefinition));
  await db.portfolio.update({ where: { id: otherPortfolio.id }, data: { archivedAt: new Date() } });
  await assert.rejects(carbon.portfolioSummary(actor, org.id, otherPortfolio.id, summaryDefinition));
  console.log(
    '✓ carbon: complete and blocked coverage, exact totals, factor boundaries, immutable snapshots, corrections, retry idempotency, tenant/role/site scope and audit',
  );
} finally {
  await cleanup();
}
