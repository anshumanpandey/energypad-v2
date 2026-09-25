import { wasteSavings } from '../../domain/waste-savings';
import type { CarbonSnapshot } from '../../domain/carbon';
import type { ReportingResult } from '../../domain/analysis/reporting';
import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from '../foundation';
import { DomainError, uuid } from '../../domain/policy';
import { fitRegression, type RegressionResult } from '../../domain/analysis/regression';
import { calculateReporting, projectReportingModel, type ReportingInput } from '../../domain/analysis/reporting';
import { interpretRegression, type RegressionInterpretation } from '../../domain/analysis/interpretation';
import { assemble } from './assembler';
import {
  nraReviewInput,
  historyPageInput,
  baselineDefinition,
  runDefinition,
  snapshotHash,
  type BaselineDefinition,
} from './contract';
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
type Assembly = Awaited<ReturnType<typeof assemble>>;
type BaselineSnapshot = {
  contract: string;
  compatibility: 'UNVALIDATED';
  approvedFixtureSet: null;
  tolerancePolicy: null;
  definition: BaselineDefinition;
  assembly: Assembly;
  interpretation?: RegressionInterpretation;
};
export class AnalysisService extends FoundationService {
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(work, { isolationLevel: 'Serializable', timeout: 20000 });
      } catch (error) {
        if (
          attempt >= 3 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2002'].includes(error.code)
        )
          throw error;
      }
    }
  }
  private async access(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    mode: 'write' | 'active' | 'history',
  ) {
    uuid.parse(siteId);
    if (mode === 'write') await this.lock(tx, org);
    const member = await this.membership(actor, org, mode === 'write' ? 'analysis:write' : undefined, tx);
    const site = await tx.site.findFirst({
      where: {
        id: siteId,
        organisationId: org,
        ...(mode === 'history' ? {} : { archivedAt: null }),
        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
          : {}),
      },
    });
    if (!site) throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
  }
  private async scope(tx: Prisma.TransactionClient, org: string, siteId: string, data: BaselineDefinition) {
    if (!(await tx.meter.findFirst({ where: { id: data.meterId, organisationId: org, siteId, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This meter is not available.', 404);
    if (
      data.energyUseId &&
      !(await tx.siteEnergyUse.findFirst({ where: { id: data.energyUseId, organisationId: org, siteId } }))
    )
      throw new DomainError('NOT_FOUND', 'This end use is not available.', 404);
  }
  private fit(definition: BaselineDefinition, assembly: Assembly) {
    return fitRegression({
      responseUnit: 'kWh',
      drivers: definition.drivers.map((code) => {
        const driver = assembly.rows[0].drivers.find((d) => d.code === code)!;
        return { code, unit: driver.unit };
      }),
      policy: definition.fitPolicy,
      observations: assembly.rows.map((row) => ({
        id: row.consumption.id,
        response: row.consumption.kwh,
        drivers: row.drivers.map((d) => d.value),
      })),
    });
  }
  async inspectReadiness(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = baselineDefinition.parse(input);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'active');
      await this.scope(tx, org, siteId, data);
      const assembly = await assemble(tx, org, siteId, data);
      if (!assembly.issues.length) {
        const fit = this.fit(data, assembly);
        if (fit.status !== 'FITTED') assembly.issues.push({ month: null, code: fit.reason, message: fit.message });
      }
      return {
        compatibility: 'UNVALIDATED' as const,
        ready: !assembly.issues.length,
        issues: assembly.issues,
        warnings: assembly.warnings,
      };
    });
  }
  async createBaseline(actor: Actor, org: string, siteId: string, input: unknown) {
    const definition = baselineDefinition.parse(input);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'write');
      await this.scope(tx, org, siteId, definition);
      const assembly = await assemble(tx, org, siteId, definition);
      if (assembly.issues.length) return { status: 'BLOCKED' as const, issues: assembly.issues };
      const fit = this.fit(definition, assembly);
      if (fit.status !== 'FITTED')
        return { status: 'BLOCKED' as const, issues: [{ month: null, code: fit.reason, message: fit.message }] };
      const snapshot: BaselineSnapshot = {
        contract: 'persisted-analysis-input-v1',
        compatibility: 'UNVALIDATED',
        approvedFixtureSet: null,
        tolerancePolicy: null,
        definition,
        assembly,
        interpretation: interpretRegression(fit),
      };
      const inputHash = snapshotHash({ snapshot, algorithm: fit.algorithm });
      const existing = await tx.baselineVersion.findUnique({
        where: { organisationId_inputHash: { organisationId: org, inputHash } },
      });
      if (existing) return { status: 'SAVED' as const, baseline: existing, reused: true };
      const previous = definition.supersedesId
        ? await tx.baselineVersion.findFirst({
            where: {
              id: definition.supersedesId,
              organisationId: org,
              siteId,
              meterId: definition.meterId,
              energyUseId: definition.energyUseId,
              replacement: { is: null },
            },
          })
        : null;
      if (definition.supersedesId && !previous)
        throw new DomainError('STALE_REVISION', 'The baseline is unavailable or has already been superseded.', 409);
      const baseline = await tx.baselineVersion.create({
        data: {
          organisationId: org,
          siteId,
          meterId: definition.meterId,
          energyUseId: definition.energyUseId,
          supersedesId: definition.supersedesId,
          revision: (previous?.revision ?? 0) + 1,
          inputHash,
          snapshot: json(snapshot),
          fit: json(fit),
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'analysis.baseline_created', baseline.id, {
        siteId,
        meterId: baseline.meterId,
        inputHash,
        compatibility: 'UNVALIDATED',
      });
      return { status: 'SAVED' as const, baseline, reused: false };
    });
  }
  async run(actor: Actor, org: string, siteId: string, baselineId: string, input: unknown) {
    const request = runDefinition.parse(input);
    uuid.parse(baselineId);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'write');
      const baseline = await tx.baselineVersion.findFirst({ where: { id: baselineId, organisationId: org, siteId } });
      if (!baseline) throw new DomainError('NOT_FOUND', 'This baseline is not available.', 404);
      const frozen = baseline.snapshot as unknown as BaselineSnapshot;
      const definition = baselineDefinition.parse(frozen.definition);
      await this.scope(tx, org, siteId, definition);
      const assembly = await assemble(tx, org, siteId, { ...definition, period: request.period });
      if (assembly.issues.length) return { status: 'BLOCKED' as const, issues: assembly.issues };
      const model = projectReportingModel(baseline.fit as unknown as RegressionResult);
      if (!model) throw new DomainError('MODEL_VERSION', 'This baseline needs a supported model version.', 409);
      const numericalInput: ReportingInput = {
        baseline: {
          id: baseline.id,
          scope: frozen.assembly.scope,
          period: definition.period,
          model,
          referenceObservations: frozen.assembly.adjustmentObservations,
        },
        period: request.period,
        policy: request.policy,
        rows: assembly.rows.map((row) => ({
          ...row,
          nraReferenceMonth: request.references.find((r) => r.month === row.consumption.month)?.referenceMonth ?? null,
          nraObservations:
            request.policy.nra === 'NONE'
              ? []
              : assembly.adjustmentObservations.filter(
                  (o) =>
                    o.month === row.consumption.month &&
                    (request.policy.nra === 'HOURS_AND_POPULATION' ||
                      o.kind === (request.policy.nra === 'HOURS' ? 'OPERATING_HOURS' : 'POPULATION')),
                ),
        })),
      };
      const output = calculateReporting(numericalInput);
      if (output.status !== 'CALCULATED') return { status: 'BLOCKED' as const, issues: output.issues };
      const snapshot = {
        contract: 'persisted-analysis-run-v1',
        compatibility: 'UNVALIDATED',
        approvedFixtureSet: null,
        tolerancePolicy: null,
        baselineId: baseline.id,
        baselineInputHash: baseline.inputHash,
        request: { ...request, references: [...request.references].sort((a, b) => a.month.localeCompare(b.month)) },
        assembly,
        numericalInput: output.inputSnapshot,
      };
      const inputHash = snapshotHash({ snapshot, algorithm: output.algorithm });
      const existing = await tx.analysisRun.findUnique({
        where: { organisationId_inputHash: { organisationId: org, inputHash } },
        include: { result: true },
      });
      if (existing) return { status: 'SAVED' as const, run: existing, reused: true };
      const run = await tx.analysisRun.create({
        data: {
          organisationId: org,
          siteId,
          meterId: baseline.meterId,
          baselineId,
          inputHash,
          snapshot: json(snapshot),
          authorId: actor.userId,
          result: { create: { output: json(output) } },
        },
        include: { result: true },
      });
      await this.audit(tx, actor, org, 'analysis.run_created', run.id, {
        siteId,
        baselineId,
        inputHash,
        compatibility: 'UNVALIDATED',
      });
      return { status: 'SAVED' as const, run, reused: false };
    });
  }
  async historySites(actor: Actor, org: string) {
    return this.transaction(async (tx) => {
      const member = await this.membership(actor, org, undefined, tx);
      const sites = await tx.site.findMany({
        where: {
          organisationId: org,
          ...(member.role === 'SITE_MANAGER'
            ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
            : {}),
        },
        select: { id: true, name: true, archivedAt: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return sites
        .map(({ archivedAt, ...site }) => ({ ...site, archived: archivedAt !== null }))
        .sort((a, b) => Number(a.archived) - Number(b.archived));
    });
  }
  async options(actor: Actor, org: string, siteId: string) {
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'active');
      const meters = await tx.meter.findMany({
        where: { organisationId: org, siteId, archivedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      const uses = await tx.siteEnergyUse.findMany({
        where: { organisationId: org, siteId },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      const weather = await tx.weatherConfiguration.findMany({
        where: { organisationId: org, siteId },
        select: { id: true, version: true, source: true },
        orderBy: { version: 'desc' },
      });
      return { meters, uses, weather };
    });
  }
  async readBaseline(actor: Actor, org: string, siteId: string, baselineId: string) {
    uuid.parse(baselineId);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      const baseline = await tx.baselineVersion.findFirst({ where: { id: baselineId, organisationId: org, siteId } });
      if (!baseline) throw new DomainError('NOT_FOUND', 'This baseline is not available.', 404);
      return baseline;
    });
  }
  async history(actor: Actor, org: string, siteId: string, input: unknown = {}) {
    const page = historyPageInput.parse(input);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      const anchor = page.cursor
        ? await tx.baselineVersion.findFirst({
            where: { id: page.cursor, organisationId: org, siteId },
            select: { id: true, createdAt: true },
          })
        : null;
      if (page.cursor && !anchor) throw new DomainError('NOT_FOUND', 'This history cursor is not available.', 404);
      const rows = await tx.baselineVersion.findMany({
        where: {
          organisationId: org,
          siteId,
          ...(anchor
            ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: page.limit + 1,
        select: {
          id: true,
          meterId: true,
          energyUseId: true,
          revision: true,
          supersedesId: true,
          inputHash: true,
          compatibility: true,
          createdAt: true,
          runs: {
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: page.limit + 1,
            select: { id: true, inputHash: true, compatibility: true, createdAt: true },
          },
        },
      });
      const items = rows.slice(0, page.limit).map((b) => ({
        ...b,
        runs: b.runs.slice(0, page.limit),
        nextRunCursor: b.runs.length > page.limit ? b.runs[page.limit - 1].id : null,
      }));
      return { items, nextCursor: rows.length > page.limit ? items[items.length - 1].id : null };
    });
  }
  async runHistory(actor: Actor, org: string, siteId: string, baselineId: string, input: unknown = {}) {
    uuid.parse(baselineId);
    const page = historyPageInput.parse(input);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      if (
        !(await tx.baselineVersion.findFirst({
          where: { id: baselineId, organisationId: org, siteId },
          select: { id: true },
        }))
      )
        throw new DomainError('NOT_FOUND', 'This baseline is not available.', 404);
      const scope = { organisationId: org, siteId, baselineId };
      const anchor = page.cursor
        ? await tx.analysisRun.findFirst({
            where: { ...scope, id: page.cursor },
            select: { id: true, createdAt: true },
          })
        : null;
      if (page.cursor && !anchor) throw new DomainError('NOT_FOUND', 'This history cursor is not available.', 404);
      const rows = await tx.analysisRun.findMany({
        where: {
          ...scope,
          ...(anchor
            ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: page.limit + 1,
        select: { id: true, inputHash: true, compatibility: true, createdAt: true },
      });
      const items = rows.slice(0, page.limit);
      return { items, nextCursor: rows.length > page.limit ? items[items.length - 1].id : null };
    });
  }
  async reviewNra(actor: Actor, org: string, siteId: string, runId: string, input: unknown) {
    const data = nraReviewInput.parse(input);
    uuid.parse(runId);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'write');
      await this.membership(actor, org, 'analysis:approve', tx);
      const run = await tx.analysisRun.findFirst({
        where: { id: runId, organisationId: org, siteId },
        include: { reviews: { orderBy: { revision: 'desc' }, take: 1 } },
      });
      if (!run) throw new DomainError('NOT_FOUND', 'This run is not available.', 404);
      if (run.authorId === actor.userId)
        throw new DomainError('INDEPENDENT_REVIEW', 'Another Owner or Admin must review this run.', 403);
      const snapshot = run.snapshot as unknown as { request: unknown };
      const parsed = runDefinition.safeParse(snapshot.request);
      if (!parsed.success || parsed.data.policy.nra === 'NONE' || !parsed.data.nraContext)
        throw new DomainError('NRA_CONTEXT', 'Save a new NRA run with rationale and evidence before review.', 409);
      const existing = await tx.nraReview.findUnique({
        where: { organisationId_requestId: { organisationId: org, requestId: data.requestId } },
      });
      if (existing) {
        if (
          existing.runId !== runId ||
          existing.reviewerId !== actor.userId ||
          existing.previousId !== data.previousId ||
          existing.decision !== data.decision ||
          existing.reason !== data.reason
        )
          throw new DomainError('REQUEST_CONFLICT', 'This review request has already been used.', 409);
        return existing;
      }
      const prior = run.reviews[0];
      if ((prior?.id ?? null) !== data.previousId)
        throw new DomainError('STALE_REVIEW', 'Review status changed. Reload this run before deciding.', 409);
      if (data.decision === 'REVOKED' && prior?.decision !== 'APPROVED')
        throw new DomainError('INVALID_REVIEW', 'Only an approval can be revoked.', 409);
      const review = await tx.nraReview.create({
        data: {
          ...data,
          organisationId: org,
          siteId,
          meterId: run.meterId,
          runId,
          revision: (prior?.revision ?? 0) + 1,
          reviewerId: actor.userId,
          policyVersion: 'nra-review-v1',
        },
      });
      await this.audit(tx, actor, org, 'analysis.nra_reviewed', review.id, {
        siteId,
        runId,
        decision: review.decision,
        revision: review.revision,
        policyVersion: review.policyVersion,
      });
      return review;
    });
  }
  async wasteRuns(actor: Actor, org: string, siteId: string, input: unknown = {}) {
    const page = historyPageInput.parse(input);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      const scope = { organisationId: org, siteId };
      const anchor = page.cursor ? await tx.analysisRun.findFirst({ where: { ...scope, id: page.cursor } }) : null;
      if (page.cursor && !anchor) throw new DomainError('NOT_FOUND', 'This cursor is not available.', 404);
      const rows = await tx.analysisRun.findMany({
        where: {
          ...scope,
          ...(anchor
            ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: page.limit + 1,
        select: { id: true, meterId: true, baselineId: true, createdAt: true, compatibility: true },
      });
      const items = rows.slice(0, page.limit);
      return { items, nextCursor: rows.length > page.limit ? items[items.length - 1].id : null };
    });
  }
  async wasteSummary(actor: Actor, org: string, siteId: string, runId: string, carbonRunId?: string) {
    uuid.parse(runId);
    if (carbonRunId) uuid.parse(carbonRunId);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      const run = await tx.analysisRun.findFirst({
        where: { id: runId, organisationId: org, siteId },
        include: { result: true, baseline: true },
      });
      if (!run?.result) throw new DomainError('NOT_FOUND', 'This saved result is not available.', 404);
      const output = run.result.output as unknown as ReportingResult;
      const readings = await tx.consumptionRecord.findMany({
        where: {
          organisationId: org,
          siteId,
          meterId: run.meterId,
          id: { in: output.rows.flatMap((r) => (r.status === 'CALCULATED' ? [r.consumptionId] : [])) },
        },
        orderBy: { id: 'asc' },
      });
      const carbon = carbonRunId
        ? await tx.carbonRun.findFirst({ where: { id: carbonRunId, organisationId: org, siteId } })
        : null;
      if (carbonRunId && !carbon) throw new DomainError('NOT_FOUND', 'This carbon run is not available.', 404);
      const snapshot = carbon?.snapshot as unknown as CarbonSnapshot | undefined;
      if (snapshot && snapshot.definition.meterId !== run.meterId)
        throw new DomainError('SCOPE', 'Choose a carbon run for the same meter.');
      return {
        runId: run.id,
        baselineId: run.baselineId,
        meterId: run.meterId,
        inputHash: run.inputHash,
        createdAt: run.createdAt.toISOString(),
        compatibility: run.compatibility,
        output,
        model: run.baseline.fit,
        evidence: {
          runSnapshot: run.snapshot,
          baseline: run.baseline,
          readings,
          carbonSnapshot: snapshot ?? null,
        },
        carbonRunId: carbon?.id ?? null,
        carbonAlgorithm: carbon?.algorithmVersion ?? null,
        carbonDefinition: snapshot?.definition ?? null,
        impact: wasteSavings(
          output,
          readings.map((r) => ({
            id: r.id,
            revision: r.revision,
            normalizedKwh: r.normalizedKwh.toString(),
            netCost: r.netCost?.toString() ?? null,
            currency: r.currency,
            estimated: r.estimated,
            conversionVersion: r.conversionVersion,
          })),
          snapshot ?? null,
        ),
      };
    });
  }
  async readRun(actor: Actor, org: string, siteId: string, runId: string) {
    uuid.parse(runId);
    return this.transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, 'history');
      const run = await tx.analysisRun.findFirst({
        where: { id: runId, organisationId: org, siteId },
        include: { result: true, baseline: true, reviews: { orderBy: { revision: 'asc' } } },
      });
      if (!run) throw new DomainError('NOT_FOUND', 'This run is not available.', 404);
      return run;
    });
  }
}
