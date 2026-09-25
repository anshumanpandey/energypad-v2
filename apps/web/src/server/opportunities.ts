import { Prisma } from '@prisma/client';
import { AnalyticsReportService, reportFingerprint } from './analytics-reports';
import type { Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { opportunityInput, opportunityReviewInput, checkOpportunityTransition } from '../domain/opportunities';
import { historyPageInput, snapshotHash } from './analysis/contract';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const include = {
  events: { orderBy: { revision: 'asc' as const } },
  owner: { select: { user: { select: { name: true, email: true } }, revokedAt: true } },
};
export class OpportunityService extends AnalyticsReportService {
  private async opportunityAccess(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    write: boolean,
  ) {
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
    return member;
  }
  async listOpportunities(actor: Actor, org: string, siteId: string, input: unknown = {}) {
    const page = historyPageInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        await this.opportunityAccess(tx, actor, org, siteId, false);
        const scope = { organisationId: org, siteId };
        const anchor = page.cursor ? await tx.opportunity.findFirst({ where: { ...scope, id: page.cursor } }) : null;
        if (page.cursor && !anchor) throw new DomainError('NOT_FOUND', 'This cursor is not available.', 404);
        const rows = await tx.opportunity.findMany({
          where: {
            ...scope,
            ...(anchor
              ? {
                  OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: page.limit + 1,
          include,
        });
        const items = rows.slice(0, page.limit);
        return { items, nextCursor: rows.length > page.limit ? items[items.length - 1].id : null };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async createOpportunity(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = opportunityInput.parse(input);
    // Saved source evidence is immutable. Authorization is repeated inside the write transaction.
    const report = await this.report(actor, org, siteId, {
      family: 'savings',
      runId: data.runId,
      ...(data.carbonRunId ? { carbonRunId: data.carbonRunId } : {}),
    });
    const requestHash = snapshotHash({ siteId, actorId: actor.userId, ...data });
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        const member = await this.opportunityAccess(tx, actor, org, siteId, true);
        const existing = await tx.opportunity.findUnique({
          where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
          include,
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new DomainError('REQUEST_CONFLICT', 'This request key was used for a different investigation.', 409);
          return existing;
        }
        if (
          await tx.opportunity.findUnique({
            where: { organisationId_runId: { organisationId: org, runId: data.runId } },
          })
        )
          throw new DomainError(
            'OPPORTUNITY_EXISTS',
            'This saved run already has an investigation. Open it in Opportunities.',
            409,
          );
        const run = await tx.analysisRun.findFirst({ where: { id: data.runId, organisationId: org, siteId } });
        if (!run) throw new DomainError('NOT_FOUND', 'This saved run is not available.', 404);
        const opportunity = await tx.opportunity.create({
          data: {
            organisationId: org,
            siteId,
            meterId: run.meterId,
            runId: run.id,
            ownerMembershipId: member.id,
            title: data.title,
            rationale: data.rationale,
            evidence: json(report),
            evidenceHash: reportFingerprint(report),
            requestKey: data.requestKey,
            requestHash,
          },
        });
        await tx.opportunityEvent.create({
          data: {
            organisationId: org,
            siteId,
            opportunityId: opportunity.id,
            revision: 1,
            status: 'DETECTED',
            note: data.rationale,
            actorId: actor.userId,
            requestKey: data.requestKey,
            requestHash,
          },
        });
        await this.audit(tx, actor, org, 'opportunity.detected', opportunity.id, {
          siteId,
          runId: run.id,
          evidenceHash: opportunity.evidenceHash,
        });
        return tx.opportunity.findUniqueOrThrow({ where: { id: opportunity.id }, include });
      },
      { timeout: 20000 },
    );
  }
  async reviewOpportunity(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    uuid.parse(id);
    const data = opportunityReviewInput.parse(input);
    const requestHash = snapshotHash({ siteId, id, actorId: actor.userId, ...data });
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.opportunityAccess(tx, actor, org, siteId, true);
      const opportunity = await tx.opportunity.findFirst({ where: { id, organisationId: org, siteId }, include });
      if (!opportunity) throw new DomainError('NOT_FOUND', 'This investigation is not available.', 404);
      const retry = await tx.opportunityEvent.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (retry) {
        if (retry.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This request key was used for a different review.', 409);
        return opportunity;
      }
      const previous = opportunity.events.at(-1)!;
      if (previous.id !== data.previousId)
        throw new DomainError('STALE_REVIEW', 'This investigation changed. Reload it before reviewing.', 409);
      checkOpportunityTransition(previous.status, data.status);
      await tx.opportunityEvent.create({
        data: {
          organisationId: org,
          siteId,
          opportunityId: id,
          previousId: previous.id,
          revision: previous.revision + 1,
          status: data.status,
          note: data.note,
          actorId: actor.userId,
          requestKey: data.requestKey,
          requestHash,
        },
      });
      await this.audit(tx, actor, org, 'opportunity.reviewed', id, {
        siteId,
        previousStatus: previous.status,
        status: data.status,
        revision: previous.revision + 1,
      });
      return tx.opportunity.findUniqueOrThrow({ where: { id }, include });
    });
  }
}
