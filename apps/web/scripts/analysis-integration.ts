import { OpportunityService } from '../src/server/opportunities';
import { AnalyticsReportService, reportFingerprint, reportResponse } from '../src/server/analytics-reports';
import { CarbonService } from '../src/server/carbon';
import { EmissionFactorService } from '../src/server/emission-factors';
import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { DriverService } from '../src/server/drivers';
import { AnalysisService } from '../src/server/analysis/service';
import { actorFor } from '../src/server/foundation';
import { interpretRegression } from '../src/domain/analysis/interpretation';
import type { RegressionResult } from '../src/domain/analysis/regression';
import { snapshotHash, type BaselineDefinition } from '../src/server/analysis/contract';
import type { ReportingInput } from '../src/domain/analysis/reporting';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} },
  url = 'http://localhost:3100';
const sites = new SiteService(db, mail, url),
  energy = new EnergyService(db, mail, url),
  drivers = new DriverService(db, mail, url),
  analysis = new AnalysisService(db, mail, url);
const reports = new AnalyticsReportService(db, mail, url);
const opportunities = new OpportunityService(db, mail, url);
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
    netCost: '20',
    vatPercent: null,
    currency: 'GBP',
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
  const fitted = first.baseline.fit as unknown as Extract<RegressionResult, { status: 'FITTED' }>;
  const storedSnapshot = first.baseline.snapshot as unknown as {
    interpretation: ReturnType<typeof interpretRegression>;
  };
  assert.deepEqual(storedSnapshot.interpretation, interpretRegression(fitted));
  assert.equal(storedSnapshot.interpretation.policy.version, 'statistical-interpretation-v1');

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
  const impact = await analysis.wasteSummary(owner, org.id, site.id, run.run.id);
  const energyReport = await reports.report(owner, org.id, site.id, { family: 'energy', year: 2020 });
  assert.equal(energyReport.summary.kwh, null); // Partial annual coverage must not become a total.
  assert.equal(energyReport.rows.length, 12);
  const baselineReport = await reports.report(owner, org.id, site.id, {
    family: 'baseline',
    baselineId: first.baseline.id,
  });
  assert.equal(baselineReport.status, 'UNVALIDATED');
  assert.equal(baselineReport.period.firstMonth, definition.period.firstMonth);
  const savingsInput = { family: 'savings', runId: run.run.id };
  const savingsReport = await reports.report(owner, org.id, site.id, savingsInput);
  const opportunityInput = {
    runId: run.run.id,
    title: 'Investigate operating hours',
    rationale: 'Compare saved variance with the operating schedule.',
    requestKey: crypto.randomUUID(),
  };
  const [opportunity, opportunityRetry] = await Promise.all([
    opportunities.createOpportunity(owner, org.id, site.id, opportunityInput),
    opportunities.createOpportunity(owner, org.id, site.id, opportunityInput),
  ]);
  assert.equal(opportunity.id, opportunityRetry.id);
  assert.equal(opportunity.events.length, 1);
  assert.equal(opportunity.events[0].status, 'DETECTED');
  assert.deepEqual(opportunity.evidence, savingsReport);
  assert.equal(await db.auditEvent.count({ where: { targetId: opportunity.id, action: 'opportunity.detected' } }), 1);
  await assert.rejects(
    opportunities.createOpportunity(owner, org.id, site.id, { ...opportunityInput, title: 'Changed request' }),
    { status: 409 },
  );
  await assert.rejects(
    opportunities.createOpportunity(owner, org.id, site.id, { ...opportunityInput, requestKey: crypto.randomUUID() }),
    { status: 409 },
  );
  await assert.rejects(
    opportunities.createOpportunity(owner, org.id, otherSite.id, {
      ...opportunityInput,
      requestKey: crypto.randomUUID(),
    }),
  );
  await assert.rejects(opportunities.listOpportunities(outsider, org.id, site.id));
  await assert.rejects(opportunities.listOpportunities(owner, org.id, otherSite.id, { cursor: opportunity.id }), {
    status: 404,
  });
  const reviewInput = {
    previousId: opportunity.events[0].id,
    status: 'REVIEWING',
    note: 'Inspect the original meter records.',
    requestKey: crypto.randomUUID(),
  };
  const reviewed = await opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, reviewInput);
  assert.equal(reviewed.events.at(-1)!.status, 'REVIEWING');
  assert.equal(
    (await opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, reviewInput)).events.length,
    2,
  );
  await assert.rejects(
    opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, {
      ...reviewInput,
      requestKey: crypto.randomUUID(),
    }),
    { status: 409 },
  );
  await assert.rejects(opportunities.reviewOpportunity(owner, org.id, otherSite.id, opportunity.id, reviewInput), {
    status: 404,
  });
  await assert.rejects(db.opportunity.update({ where: { id: opportunity.id }, data: { title: 'Rewrite history' } }));
  await assert.rejects(
    db.opportunityEvent.update({ where: { id: reviewed.events[1].id }, data: { note: 'Rewrite decision' } }),
  );
  await assert.rejects(
    db.opportunityEvent.create({
      data: {
        organisationId: org.id,
        siteId: site.id,
        opportunityId: opportunity.id,
        previousId: reviewed.events[1].id,
        revision: 3,
        status: 'VERIFIED',
        note: 'Invalid promotion',
        actorId: owner.userId,
        requestKey: crypto.randomUUID(),
        requestHash: 'test',
      },
    }),
  );
  const rejectedOpportunity = await opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, {
    previousId: reviewed.events[1].id,
    status: 'REJECTED',
    note: 'Evidence is insufficient for this investigation.',
    requestKey: crypto.randomUUID(),
  });
  assert.equal(rejectedOpportunity.events.length, 3);
  await assert.rejects(
    opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, {
      previousId: rejectedOpportunity.events[2].id,
      status: 'REVIEWING',
      note: 'Cannot reopen a terminal state',
      requestKey: crypto.randomUUID(),
    }),
    { status: 409 },
  );

  assert.equal(savingsReport.summary.postKwh, impact.impact.postKwh);
  assert.equal(savingsReport.summary.postCost, impact.impact.postCost);
  assert.deepEqual(savingsReport.period, request.period);
  assert.deepEqual(await reportResponse(savingsReport, 'json', reportFingerprint(savingsReport)).json(), savingsReport);
  for (const input of [
    { family: 'energy', year: 2020 },
    { family: 'baseline', baselineId: first.baseline.id },
    savingsInput,
  ]) {
    await assert.rejects(reports.report(outsider, org.id, site.id, input));
  }
  await assert.rejects(reports.report(owner, org.id, otherSite.id, savingsInput));
  await assert.rejects(
    reports.report(owner, org.id, otherSite.id, { family: 'baseline', baselineId: first.baseline.id }),
  );

  assert.equal(impact.runId, run.run.id);
  assert.equal(impact.impact.complete, true);
  assert.notEqual(impact.impact.postCost, null);
  assert.equal(impact.impact.postCarbon, null);
  const factors = new EmissionFactorService(db, mail, url);
  const carbon = new CarbonService(db, mail, url);
  const factorInput = {
    fuel: 'ELECTRICITY',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.2',
    source: 'Synthetic impact test',
    firstDay: '2020-01-01',
    lastDay: '2020-12-31',
  };
  const factor = await factors.add(owner, org.id, factorInput);
  const carbonRun = await carbon.calculate(owner, org.id, site.id, {
    meterId: meter.id,
    year: 2020,
    geography: 'GB',
    basis: 'LOCATION_BASED',
    requestKey: crypto.randomUUID(),
  });
  const pinnedImpact = await analysis.wasteSummary(owner, org.id, site.id, run.run.id, carbonRun.id);
  const pinnedReport = await reports.report(owner, org.id, site.id, { ...savingsInput, carbonRunId: carbonRun.id });
  assert.equal(pinnedReport.summary.postCarbon, pinnedImpact.impact.postCarbon);

  assert.notEqual(pinnedImpact.impact.postCarbon, null);
  await assert.rejects(analysis.wasteSummary(outsider, org.id, site.id, run.run.id, carbonRun.id));
  await factors.add(owner, org.id, { ...factorInput, factor: '0.9' }, factor.id, 'Correct factor');
  assert.deepEqual(await analysis.wasteSummary(owner, org.id, site.id, run.run.id, carbonRun.id), pinnedImpact);
  assert.deepEqual(
    await reports.report(owner, org.id, site.id, { ...savingsInput, carbonRunId: carbonRun.id }),
    pinnedReport,
  );
  assert.deepEqual(
    await reports.report(owner, org.id, site.id, { family: 'baseline', baselineId: first.baseline.id }),
    baselineReport,
  );

  assert.equal((await analysis.wasteRuns(owner, org.id, site.id)).items[0].id, run.run.id);
  await assert.rejects(analysis.wasteSummary(outsider, org.id, site.id, run.run.id));
  await assert.rejects(analysis.wasteSummary(owner, org.id, otherSite.id, run.run.id));
  await assert.rejects(analysis.wasteRuns(outsider, org.id, site.id));

  await assert.rejects(analysis.readRun(outsider, org.id, site.id, run.run.id));
  await assert.rejects(analysis.readRun(owner, org.id, otherSite.id, run.run.id));
  for (const role of ['VIEWER', 'SITE_MANAGER'] as const) {
    const actor = actorFor(
      (await db.user.create({ data: { email: `${role}@example.test`, emailVerified: new Date() } })).id,
    );
    const member = await db.membership.create({ data: { organisationId: org.id, userId: actor.userId, role } });
    await assert.rejects(analysis.createBaseline(actor, org.id, site.id, definition));
    if (role === 'SITE_MANAGER') {
      await assert.rejects(analysis.wasteSummary(actor, org.id, site.id, run.run.id));
      for (const input of [
        { family: 'energy', year: 2020 },
        { family: 'baseline', baselineId: first.baseline.id },
        savingsInput,
      ])
        await assert.rejects(reports.report(actor, org.id, site.id, input));

      await assert.rejects(analysis.wasteRuns(actor, org.id, site.id));
      await assert.rejects(opportunities.listOpportunities(actor, org.id, site.id));
      await assert.rejects(analysis.readRun(actor, org.id, site.id, run.run.id));
      await db.siteAssignment.create({ data: { membershipId: member.id, organisationId: org.id, siteId: site.id } });
    }
    assert.equal((await analysis.wasteSummary(actor, org.id, site.id, run.run.id)).runId, run.run.id);
    assert.deepEqual(await reports.report(actor, org.id, site.id, savingsInput), savingsReport);
    assert.equal((await opportunities.listOpportunities(actor, org.id, site.id)).items[0].id, opportunity.id);
    await assert.rejects(opportunities.createOpportunity(actor, org.id, site.id, opportunityInput), { status: 403 });
    await assert.rejects(opportunities.reviewOpportunity(actor, org.id, site.id, opportunity.id, reviewInput), {
      status: 403,
    });

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
    nraContext: {
      rationale: 'Occupancy changed; use the selected baseline month.',
      evidence: ['Synthetic monthly population observations'],
    },
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
  const reviewRequest = {
    requestId: crypto.randomUUID(),
    previousId: null,
    decision: 'APPROVED',
    reason: 'Reviewed the reference observations and assumptions.',
  };
  await assert.rejects(analysis.reviewNra(analyst, org.id, site.id, analystRun.run.id, reviewRequest), { status: 403 });
  await assert.rejects(analysis.reviewNra(outsider, org.id, site.id, analystRun.run.id, reviewRequest));
  await assert.rejects(analysis.reviewNra(owner, org.id, otherSite.id, analystRun.run.id, reviewRequest), {
    status: 404,
  });
  // Even an Owner cannot self-approve.
  await assert.rejects(analysis.reviewNra(owner, org.id, site.id, run.run.id, reviewRequest), { status: 403 });
  const [approved, approvedRetry] = await Promise.all([
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, reviewRequest),
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, reviewRequest),
  ]);
  assert.equal(approved.id, approvedRetry.id);
  assert.equal(await db.auditEvent.count({ where: { targetId: approved.id, action: 'analysis.nra_reviewed' } }), 1);
  assert.equal((await analysis.readRun(owner, org.id, site.id, analystRun.run.id)).compatibility, 'UNVALIDATED');
  await assert.rejects(
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, { ...reviewRequest, reason: 'Changed retry' }),
    { status: 409 },
  );
  await assert.rejects(
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, { ...reviewRequest, requestId: crypto.randomUUID() }),
    { status: 409 },
  );
  await assert.rejects(
    analysis.reviewNra({ ...owner, correlationId: 'invalid-uuid' }, org.id, site.id, analystRun.run.id, {
      ...reviewRequest,
      requestId: crypto.randomUUID(),
      previousId: approved.id,
      decision: 'REVOKED',
    }),
  );
  assert.equal(await db.nraReview.count({ where: { runId: analystRun.run.id } }), 1);
  const revoked = await analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, {
    ...reviewRequest,
    requestId: crypto.randomUUID(),
    previousId: approved.id,
    decision: 'REVOKED',
    reason: 'Evidence needs clarification.',
  });
  const rejected = await analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, {
    ...reviewRequest,
    requestId: crypto.randomUUID(),
    previousId: revoked.id,
    decision: 'REJECTED',
    reason: 'Reference month is unsuitable.',
  });
  assert.equal(rejected.revision, 3);
  await assert.rejects(
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, {
      ...reviewRequest,
      requestId: crypto.randomUUID(),
      previousId: rejected.id,
      decision: 'REVOKED',
    }),
    { status: 409 },
  );
  await assert.rejects(db.nraReview.update({ where: { id: approved.id }, data: { reason: 'rewrite' } }));
  await assert.rejects(db.nraReview.delete({ where: { id: approved.id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE TABLE "NraReview"'));
  await assert.rejects(
    db.nraReview.create({
      data: {
        ...approved,
        id: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        siteId: otherSite.id,
        previousId: rejected.id,
        revision: 4,
      },
    }),
  );
  const changedContext = await analysis.run(analyst, org.id, site.id, analystBaseline.baseline.id, {
    ...request,
    policy: { ...policy, nra: 'POPULATION' },
    references: [{ month: '2020-05', referenceMonth: '2020-01' }],
    nraContext: { rationale: 'Revised assumptions for review.', evidence: ['Revised occupancy log'] },
  });
  if (changedContext.status !== 'SAVED') throw Error('Changed NRA failed');
  assert.notEqual(changedContext.run.id, analystRun.run.id);
  assert.equal((await analysis.readRun(owner, org.id, site.id, changedContext.run.id)).reviews.length, 0);
  const admin = actorFor(
    (await db.user.create({ data: { email: 'nra-admin@example.test', emailVerified: new Date() } })).id,
  );
  const adminMember = await db.membership.create({
    data: { organisationId: org.id, userId: admin.userId, role: 'ADMIN' },
  });
  await analysis.reviewNra(admin, org.id, site.id, changedContext.run.id, {
    ...reviewRequest,
    requestId: crypto.randomUUID(),
  });
  await db.membership.update({ where: { id: adminMember.id }, data: { role: 'VIEWER' } });
  await assert.rejects(
    analysis.reviewNra(admin, org.id, site.id, changedContext.run.id, {
      ...reviewRequest,
      requestId: crypto.randomUUID(),
    }),
    { status: 403 },
  );
  const legacySnapshot = JSON.parse(JSON.stringify(analystRun.run.snapshot));
  delete legacySnapshot.request.nraContext;
  const legacyRun = await db.analysisRun.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      meterId: meter.id,
      baselineId: analystBaseline.baseline.id,
      authorId: analyst.userId,
      snapshot: legacySnapshot,
      inputHash: snapshotHash({ legacySnapshot }),
      result: { create: { output: JSON.parse(JSON.stringify(analystRun.run.result!.output)) } },
    },
  });
  await assert.rejects(
    analysis.reviewNra(owner, org.id, site.id, legacyRun.id, { ...reviewRequest, requestId: crypto.randomUUID() }),
    { code: 'NRA_CONTEXT' },
  );
  assert.equal((await analysis.readRun(owner, org.id, site.id, legacyRun.id)).reviews.length, 0);
  console.log(
    '✓ independent NRA review, atomic audit, retry/stale protection, immutable decisions and fresh review after corrections',
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
  assert.deepEqual(await analysis.wasteSummary(owner, org.id, site.id, run.run.id, carbonRun.id), pinnedImpact);
  assert.deepEqual(
    await reports.report(owner, org.id, site.id, { ...savingsInput, carbonRunId: carbonRun.id }),
    pinnedReport,
  );
  assert.deepEqual(
    await reports.report(owner, org.id, site.id, { family: 'baseline', baselineId: first.baseline.id }),
    baselineReport,
  );

  assert.deepEqual(await analysis.readRun(owner, org.id, site.id, run.run.id), saved);
  // Baseline observations are frozen: changing current source revisions must not alter an old baseline's NRA inputs.
  const nraRequest = {
    ...request,
    policy: { ...policy, nra: 'POPULATION' },
    nraContext: {
      rationale: 'Occupancy changed; use the selected baseline month.',
      evidence: ['Synthetic monthly population observations'],
    },
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
  const historyReader = actorFor(
    (await db.user.create({ data: { email: 'history-reader@example.test', emailVerified: new Date() } })).id,
  );
  const historyMember = await db.membership.create({
    data: { organisationId: org.id, userId: historyReader.userId, role: 'SITE_MANAGER' },
  });
  await db.siteAssignment.create({ data: { membershipId: historyMember.id, organisationId: org.id, siteId: site.id } });
  assert.ok((await analysis.historySites(historyReader, org.id)).some((s) => s.id === site.id));
  const beforeArchive = await analysis.readRun(owner, org.id, site.id, run.run.id);
  await sites.archiveSite(owner, org.id, site.id);
  await assert.rejects(
    analysis.reviewNra(owner, org.id, site.id, analystRun.run.id, {
      ...reviewRequest,
      requestId: crypto.randomUUID(),
      previousId: rejected.id,
    }),
    { status: 404 },
  );
  assert.ok((await analysis.historySites(owner, org.id)).some((s) => s.id === site.id && s.archived));
  assert.deepEqual(await analysis.readRun(owner, org.id, site.id, run.run.id), beforeArchive);
  assert.equal((await analysis.readBaseline(owner, org.id, site.id, first.baseline.id)).id, first.baseline.id);
  assert.ok((await analysis.history(owner, org.id, site.id)).items.length);
  assert.ok((await analysis.runHistory(owner, org.id, site.id, first.baseline.id)).items.length);
  await assert.rejects(analysis.options(owner, org.id, site.id), { status: 404 });
  await assert.rejects(analysis.inspectReadiness(owner, org.id, site.id, definition), { status: 404 });
  await assert.rejects(analysis.createBaseline(owner, org.id, site.id, definition), { status: 404 });
  await assert.rejects(analysis.run(owner, org.id, site.id, first.baseline.id, request), { status: 404 });
  await assert.rejects(analysis.readRun(outsider, org.id, site.id, run.run.id));
  await assert.rejects(analysis.historySites(outsider, org.id));
  // Archiving revokes site assignments under the existing site policy.
  assert.equal((await analysis.historySites(historyReader, org.id)).length, 0);
  await assert.rejects(analysis.readRun(historyReader, org.id, site.id, run.run.id), { status: 404 });
  await assert.rejects(analysis.history(historyReader, org.id, site.id), { status: 404 });
  await assert.rejects(analysis.runHistory(historyReader, org.id, site.id, first.baseline.id), { status: 404 });
  await assert.rejects(analysis.readBaseline(historyReader, org.id, site.id, first.baseline.id), { status: 404 });
  // Exercise an explicitly retained assignment, without bypassing the read policy.
  await db.siteAssignment.create({ data: { membershipId: historyMember.id, organisationId: org.id, siteId: site.id } });
  assert.equal((await analysis.readRun(historyReader, org.id, site.id, run.run.id)).id, run.run.id);
  assert.equal((await analysis.historySites(historyReader, org.id))[0].archived, true);
  await db.membership.update({ where: { id: historyMember.id }, data: { revokedAt: new Date() } });
  await assert.rejects(analysis.readRun(historyReader, org.id, site.id, run.run.id));
  await assert.rejects(analysis.historySites(historyReader, org.id));

  await assert.rejects(reports.report(historyReader, org.id, site.id, savingsInput));
  assert.deepEqual(await reports.report(owner, org.id, site.id, savingsInput), savingsReport);
  const changedEnergy = await reports.report(owner, org.id, site.id, { family: 'energy', year: 2020 });
  assert.throws(() => reportResponse(changedEnergy, 'json', reportFingerprint(energyReport)), { status: 409 });

  const archivedOpportunities = await opportunities.listOpportunities(owner, org.id, site.id);
  assert.deepEqual(archivedOpportunities.items[0].evidence, savingsReport);
  assert.equal(archivedOpportunities.items[0].events.length, 3);
  await assert.rejects(opportunities.reviewOpportunity(owner, org.id, site.id, opportunity.id, reviewInput), {
    status: 404,
  });
  await assert.rejects(opportunities.createOpportunity(owner, org.id, site.id, opportunityInput), { status: 404 });
  await assert.rejects(opportunities.listOpportunities(historyReader, org.id, site.id));
  console.log('✓ opportunity evidence, immutable review history, retries, stale transitions and scoped access');
  console.log('✓ archived history preserved, active calculations blocked, scoped discovery and revoked access denied');
} finally {
  await cleanup();
}
