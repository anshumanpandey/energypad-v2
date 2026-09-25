import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { carbonTargetInput, targetCorrectionInput, targetAssessmentInput } from '../domain/carbon-targets';
import type { CarbonSnapshot } from '../domain/carbon';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export class CarbonTargetService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, write = false) {
    uuid.parse(siteId);
    const member = await this.membership(actor, org, write ? 'analysis:write' : undefined, tx);
    const site = await tx.site.findFirst({
      where: {
        id: siteId,
        organisationId: org,
        ...(write ? { archivedAt: null } : {}),
        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
          : {}),
      },
    });
    if (!site) throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
  }
  async list(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId);
        return tx.carbonTargetVersion.findMany({
          where: { organisationId: org, siteId },
          include: { assessments: { orderBy: { createdAt: 'desc' } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown, supersedesId?: string, reason?: string) {
    return this.db.$transaction((tx) => this.addWithin(tx, actor, org, siteId, input, supersedesId, reason));
  }
  async addWithin(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    supersedesId?: string,
    reason?: string,
  ) {
    const data = carbonTargetInput.parse(input);
    await this.lock(tx, org);
    await this.access(tx, actor, org, siteId, true);
    const existing = await tx.carbonTargetVersion.findUnique({
      where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
    });
    if (existing) {
      const same =
        existing.siteId === siteId &&
        existing.supersedesId === (supersedesId ?? null) &&
        existing.correctionReason === (reason ?? null) &&
        Object.entries(data).every(([k, v]) =>
          k === 'limitKgCO2e' ? existing.limitKgCO2e.eq(String(v)) : existing[k as keyof typeof existing] === v,
        );
      if (!same) throw new DomainError('REQUEST_CONFLICT', 'Use a new request key for a different target.', 409);
      return existing;
    }
    if (!(await tx.meter.findFirst({ where: { id: data.meterId, organisationId: org, siteId, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'Choose an active meter in this site.', 404);
    const previous = supersedesId
      ? await tx.carbonTargetVersion.findFirst({
          where: { id: uuid.parse(supersedesId), organisationId: org, siteId, replacement: { is: null } },
        })
      : null;
    if (supersedesId && !previous)
      throw new DomainError(
        'STALE_REVISION',
        'This target changed or is unavailable. Reload before correcting it.',
        409,
      );
    if (
      previous &&
      (previous.meterId !== data.meterId ||
        previous.year !== data.year ||
        previous.geography !== data.geography ||
        previous.basis !== data.basis)
    )
      throw new DomainError('IDENTITY', 'Keep the same meter, year, geography and basis when correcting a target.');
    if (
      await tx.carbonTargetVersion.findFirst({
        where: {
          organisationId: org,
          siteId,
          meterId: data.meterId,
          year: data.year,
          geography: data.geography,
          basis: data.basis,
          replacement: { is: null },
          ...(previous ? { id: { not: previous.id } } : {}),
        },
      })
    )
      throw new DomainError(
        'TARGET_EXISTS',
        'A target exists for this meter and reporting period. Correct it instead.',
        409,
      );
    const target = await tx.carbonTargetVersion.create({
      data: {
        ...data,
        organisationId: org,
        siteId,
        authorId: actor.userId,
        ...(previous ? { supersedesId: previous.id, correctionReason: reason, revision: previous.revision + 1 } : {}),
      },
    });
    await this.audit(tx, actor, org, previous ? 'carbon.target_corrected' : 'carbon.target_added', target.id, {
      siteId,
      meterId: data.meterId,
      ...(previous ? { supersedesId: previous.id, reason } : {}),
    });
    return target;
  }
  async correct(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { target, reason } = targetCorrectionInput.parse(input);
    return this.add(actor, org, siteId, target, id, reason);
  }
  async assess(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { runId } = targetAssessmentInput.parse(input);
    uuid.parse(id);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.access(tx, actor, org, siteId, true);
      const target = await tx.carbonTargetVersion.findFirst({ where: { id, organisationId: org, siteId } });
      const run = await tx.carbonRun.findFirst({ where: { id: runId, organisationId: org, siteId } });
      if (!target || !run) throw new DomainError('NOT_FOUND', 'The target or saved calculation is unavailable.', 404);
      const existing = await tx.carbonTargetAssessment.findUnique({
        where: { targetId_runId: { targetId: id, runId } },
      });
      if (existing) return existing;
      if (await tx.carbonTargetVersion.findFirst({ where: { supersedesId: id, organisationId: org, siteId } }))
        throw new DomainError('STALE_REVISION', 'Assess the current target revision.', 409);
      const snapshot = run.snapshot as unknown as CarbonSnapshot;
      const definition = snapshot.definition;
      if (snapshot.status !== 'COMPLETE' || snapshot.totalKgCO2e === null)
        throw new DomainError('INCOMPLETE', 'Select a complete saved calculation.');
      if (
        definition.meterId !== target.meterId ||
        definition.year !== target.year ||
        definition.geography !== target.geography ||
        definition.basis !== target.basis
      )
        throw new DomainError('SCOPE', 'The saved calculation must match the target meter, year, geography and basis.');
      const actual = new Decimal(snapshot.totalKgCO2e),
        variance = actual.minus(target.limitKgCO2e.toString());
      const result = await tx.carbonTargetAssessment.create({
        data: {
          organisationId: org,
          siteId,
          targetId: id,
          runId,
          status: variance.lte(0) ? 'MET' : 'EXCEEDED',
          actualKgCO2e: actual.toFixed(),
          varianceKgCO2e: variance.toFixed(),
          algorithmVersion: 'absolute-carbon-limit-v1',
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'carbon.target_assessed', result.id, {
        siteId,
        targetId: id,
        runId,
        status: result.status,
      });
      return result;
    });
  }
}
