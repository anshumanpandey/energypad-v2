import { OpportunityService } from './opportunities';
import type { AnalyticsReport } from '../domain/analytics-report';
import type { EvidencePreview } from '../domain/ai-evidence';
import { Prisma } from '@prisma/client';
import { reportResponse, reportFingerprint } from './analytics-reports';
import { type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { aiEvidenceInput, evidencePreview } from '../domain/ai-evidence';
import { historyPageInput, snapshotHash } from './analysis/contract';
export class AIEvidenceService extends OpportunityService {
  protected async evidenceAccess(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string) {
    uuid.parse(siteId);
    const member = await this.membership(actor, org, undefined, tx);
    const site = await tx.site.findFirst({
      where: {
        id: siteId,
        organisationId: org,
        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
          : {}),
      },
    });
    if (!site) throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
  }
  async previewEvidence(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = aiEvidenceInput.parse(input);
    const requestHash = snapshotHash({ actorId: actor.userId, org, siteId, ...data });
    // Check access even for a retry. Never return another user's interaction.
    const retry = await this.db.$transaction(async (tx) => {
      await this.evidenceAccess(tx, actor, org, siteId);
      const row = await tx.aIInteraction.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (row && (row.authorId !== actor.userId || row.requestHash !== requestHash))
        throw new DomainError('REQUEST_CONFLICT', 'This request key was used for a different evidence preview.', 409);
      return row;
    });
    if (retry) return retry;
    // This closed dispatcher accepts only immutable saved-result IDs. Prompts are never executed.
    const report =
      data.tool === 'saved_opportunity'
        ? await this.opportunityReport(actor, org, siteId, data.resourceId)
        : await this.report(
            actor,
            org,
            siteId,
            data.tool === 'saved_baseline'
              ? { family: 'baseline', baselineId: data.resourceId }
              : { family: 'savings', runId: data.resourceId, carbonRunId: data.carbonRunId },
          );
    if (report.organisationId !== org || report.siteId !== siteId)
      throw new DomainError('NOT_FOUND', 'This evidence is not available.', 404);
    const result = evidencePreview(report, data.tool, data.resourceId, reportFingerprint(report));
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.evidenceAccess(tx, actor, org, siteId);
      const concurrent = await tx.aIInteraction.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (concurrent) {
        if (concurrent.authorId !== actor.userId || concurrent.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This request key was used for a different evidence preview.', 409);
        return concurrent;
      }
      const row = await tx.aIInteraction.create({
        data: {
          organisationId: org,
          siteId,
          authorId: actor.userId,
          mode: result.mode,
          tool: data.tool,
          resourceId: data.resourceId,
          promptHash: snapshotHash(data.question),
          promptCharacters: data.question.length,
          result: JSON.parse(JSON.stringify(result)),
          resultHash: snapshotHash(result),
          requestKey: data.requestKey,
          requestHash,
        },
      });
      await this.audit(tx, actor, org, 'ai.evidence_previewed', row.id, {
        siteId,
        tool: data.tool,
        resourceId: data.resourceId,
        promptHash: row.promptHash,
        resultHash: row.resultHash,
        usage: result.usage,
      });
      return row;
    });
  }
  async citedOpportunitySource(actor: Actor, org: string, siteId: string, id: string) {
    uuid.parse(id);
    return this.db.$transaction(async (tx) => {
      await this.evidenceAccess(tx, actor, org, siteId);
      const row = await tx.aIInteraction.findFirst({
        where: { id, organisationId: org, siteId, authorId: actor.userId, tool: 'saved_opportunity' },
      });
      if (!row) throw new DomainError('NOT_FOUND', 'This source snapshot is not available.', 404);
      const preview = row.result as unknown as EvidencePreview;
      const report = preview.sourceSnapshot as AnalyticsReport;
      if (
        !report ||
        report.organisationId !== org ||
        report.siteId !== siteId ||
        reportFingerprint(report) !== preview.citations[0]?.fingerprint
      )
        throw new DomainError('EVIDENCE_INVALID', 'This source snapshot failed its integrity check.', 409);
      return reportResponse(report, 'json');
    });
  }
  async evidenceHistory(actor: Actor, org: string, siteId: string, input: unknown = {}) {
    const page = historyPageInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        await this.evidenceAccess(tx, actor, org, siteId);
        const scope = { organisationId: org, siteId, authorId: actor.userId };
        const anchor = page.cursor ? await tx.aIInteraction.findFirst({ where: { ...scope, id: page.cursor } }) : null;
        if (page.cursor && !anchor) throw new DomainError('NOT_FOUND', 'This history cursor is not available.', 404);
        const rows = await tx.aIInteraction.findMany({
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
        });
        const items = rows.slice(0, page.limit);
        return { items, nextCursor: rows.length > page.limit ? items.at(-1)!.id : null };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
