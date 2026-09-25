import { supportingEvidenceInput } from '../domain/opportunity-supporting';
import {
  verificationInput,
  checkVerificationPeriod,
  verificationEligibility,
  requireVerifiedEligibility,
} from '../domain/opportunity-verification';
import type { AnalyticsReport } from '../domain/analytics-report';
import { Prisma } from '@prisma/client';
import { AnalyticsReportService, reportFingerprint } from './analytics-reports';
import type { Actor } from './foundation';
import { DomainError, uuid, can } from '../domain/policy';
import {
  opportunityInput,
  opportunityReviewInput,
  checkOpportunityTransition,
  opportunityWorkInput,
  checkWorkChange,
  type OpportunityAction,
} from '../domain/opportunities';
import { historyPageInput, snapshotHash } from './analysis/contract';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const ownerInclude = { select: { user: { select: { name: true, email: true } }, revokedAt: true } } as const;
const include = {
  supportingEvidence: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
  verifications: { orderBy: { revision: 'asc' as const } },
  workVersions: { orderBy: { revision: 'asc' as const }, include: { owner: ownerInclude } },
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
  async opportunityReport(actor: Actor, org: string, siteId: string, id: string): Promise<AnalyticsReport> {
    uuid.parse(id);
    return this.db.$transaction(
      async (tx) => {
        await this.opportunityAccess(tx, actor, org, siteId, false);
        const item = await tx.opportunity.findFirst({ where: { id, organisationId: org, siteId }, include });
        if (!item) throw new DomainError('NOT_FOUND', 'This investigation is not available.', 404);
        const original = item.evidence as unknown as AnalyticsReport;
        const work = item.workVersions.at(-1),
          actions = (work?.actions ?? []) as unknown as OpportunityAction[];
        const currentSupporting = item.supportingEvidence.filter(
          (r) => !item.supportingEvidence.some((next) => next.previousId === r.id),
        );
        const { requestKey: _key, requestHash: _hash, ...record } = item;
        void _key;
        void _hash;
        const clean = <T extends { requestKey: string; requestHash: string }>(row: T) => {
          const { requestKey, requestHash, ...rest } = row;
          void requestKey;
          void requestHash;
          return rest;
        };
        return JSON.parse(
          JSON.stringify({
            reportVersion: 'analytics-report-v1',
            family: 'opportunity',
            organisationId: org,
            siteId,
            period: original.period,
            status: original.status,
            note: 'Investigation evidence snapshot. Operational approval, implementation, supporting tips and verification submissions do not establish verified savings. The reporting period belongs to the original saved analysis.',
            units: {
              actionCount: 'actions',
              completedActionCount: 'actions',
              supportingRecordCount: 'records',
              verificationRevisionCount: 'revisions',
              verifiedKwh: 'kWh',
            },
            summary: {
              opportunityId: id,
              stage: item.events.at(-1)!.status,
              actionCount: actions.length,
              completedActionCount: actions.filter((a) => a.status === 'DONE').length,
              supportingRecordCount: currentSupporting.length,
              verificationRevisionCount: item.verifications.length,
              verifiedKwh: null,
              workVersionId: work?.id ?? null,
              stageEventId: item.events.at(-1)!.id,
            },
            rows: [],
            evidence: {
              ...record,
              events: item.events.map(clean),
              workVersions: item.workVersions.map(clean),
              supportingEvidence: item.supportingEvidence.map(clean),
              verifications: item.verifications.map(clean),
            },
          }),
        );
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  private async workOwners(tx: Prisma.TransactionClient, org: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const owners = await tx.membership.findMany({
      where: {
        organisationId: org,
        id: { in: unique },
        revokedAt: null,
        role: { in: ['OWNER', 'ADMIN', 'ANALYST'] },
        user: { OR: [{ emailVerified: { not: null } }, { passwordCredential: { isNot: null } }] },
      },
      select: { id: true, user: { select: { name: true, email: true } } },
    });
    if (owners.length !== unique.length)
      throw new DomainError(
        'WORK_OWNER',
        'Choose an active owner, admin or analyst in this workspace. Reload the owner list if membership changed.',
      );
    return owners;
  }
  async supportingOptions(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(async (tx) => {
      await this.opportunityAccess(tx, actor, org, siteId, true);
      const energyUses = await tx.siteEnergyUse.findMany({
        where: { organisationId: org, siteId },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      const logs = await tx.operationalEvent.findMany({
        where: { organisationId: org, siteId, replacement: { is: null } },
        select: { id: true, eventCode: true, operation: true, revision: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 100,
      });
      return { energyUses, logs };
    });
  }
  async saveSupportingEvidence(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    uuid.parse(id);
    const data = supportingEvidenceInput.parse(input);
    const requestHash = snapshotHash({ siteId, id, actorId: actor.userId, ...data });
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.opportunityAccess(tx, actor, org, siteId, true);
      const opportunity = await tx.opportunity.findFirst({ where: { id, organisationId: org, siteId }, include });
      if (!opportunity) throw new DomainError('NOT_FOUND', 'This investigation is not available.', 404);
      const retry = await tx.opportunitySupportingEvidence.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (retry) {
        if (retry.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This request key was used for different evidence.', 409);
        return opportunity;
      }
      const event = opportunity.events.at(-1)!;
      const work = opportunity.workVersions.at(-1);
      if (event.id !== data.eventId || (work?.id ?? null) !== data.workVersionId)
        throw new DomainError(
          'STALE_EVIDENCE',
          'The stage or action plan changed. Reload before saving evidence.',
          409,
        );
      if (['VERIFIED', 'REJECTED'].includes(event.status))
        throw new DomainError('EVIDENCE_CLOSED', 'This investigation is closed.', 409);
      const previous = data.previousId ? opportunity.supportingEvidence.find((e) => e.id === data.previousId) : null;
      if (
        data.previousId &&
        (!previous ||
          previous.kind !== data.kind ||
          opportunity.supportingEvidence.some((e) => e.previousId === data.previousId))
      )
        throw new DomainError('STALE_EVIDENCE', 'Choose the latest evidence revision of the same kind.', 409);
      const action = data.actionId
        ? (work?.actions as unknown as OpportunityAction[]).find((a) => a.id === data.actionId)
        : null;
      if (data.actionId && !action)
        throw new DomainError('EVIDENCE_ACTION', 'Choose an action from the current saved plan.');
      let source: unknown;
      if (data.kind === 'LOG') {
        const log = await tx.operationalEvent.findFirst({
          where: { id: data.operationalEventId, organisationId: org, siteId },
          include: { energyUse: true },
        });
        if (!log) throw new DomainError('NOT_FOUND', 'This operational log is not available for this site.', 404);
        source = log;
      } else {
        const energyUse = await tx.siteEnergyUse.findFirst({
          where: { id: data.energyUseId, organisationId: org, siteId },
        });
        if (!energyUse) throw new DomainError('NOT_FOUND', 'This end use is not available for this site.', 404);
        source = {
          energyUse,
          source: data.source,
          legacySource: data.legacySource,
          legacyId: data.legacyId,
          ...(data.kind === 'PROGRAMME'
            ? { title: data.title, question: data.question, answers: data.answers }
            : { category: data.category, text: data.text, month: data.month }),
        };
      }
      const snapshot = {
        version: 'opportunity-supporting-v1',
        kind: data.kind,
        organisationId: org,
        siteId,
        source,
        workVersionId: work?.id ?? null,
        action: action ?? null,
        stageEventId: event.id,
        meaning: 'Supporting evidence or recommendation; not measured or verified savings.',
      };
      const record = await tx.opportunitySupportingEvidence.create({
        data: {
          organisationId: org,
          siteId,
          opportunityId: id,
          previousId: previous?.id,
          revision: (previous?.revision ?? 0) + 1,
          kind: data.kind,
          snapshot: json(snapshot),
          snapshotHash: snapshotHash(json(snapshot)),
          note: data.note,
          authorId: actor.userId,
          requestKey: data.requestKey,
          requestHash,
        },
      });
      await this.audit(tx, actor, org, 'opportunity.evidence_saved', id, {
        siteId,
        evidenceId: record.id,
        kind: data.kind,
        revision: record.revision,
      });
      return tx.opportunity.findUniqueOrThrow({ where: { id }, include });
    });
  }
  async opportunityOwners(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(async (tx) => {
      await this.opportunityAccess(tx, actor, org, siteId, true);
      return tx.membership.findMany({
        where: {
          organisationId: org,
          revokedAt: null,
          role: { in: ['OWNER', 'ADMIN', 'ANALYST'] },
          user: { OR: [{ emailVerified: { not: null } }, { passwordCredential: { isNot: null } }] },
        },
        select: { id: true, user: { select: { name: true, email: true } } },
        orderBy: { id: 'asc' },
      });
    });
  }
  async saveOpportunityWork(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    uuid.parse(id);
    const data = opportunityWorkInput.parse(input);
    const requestHash = snapshotHash({ siteId, id, actorId: actor.userId, ...data });
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.opportunityAccess(tx, actor, org, siteId, true);
      const opportunity = await tx.opportunity.findFirst({ where: { id, organisationId: org, siteId }, include });
      if (!opportunity) throw new DomainError('NOT_FOUND', 'This investigation is not available.', 404);
      const retry = await tx.opportunityWorkVersion.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (retry) {
        if (retry.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This request key was used for different work.', 409);
        return opportunity;
      }
      const event = opportunity.events.at(-1)!;
      const previous = opportunity.workVersions.at(-1);
      if (event.id !== data.eventId || (previous?.id ?? null) !== data.previousId)
        throw new DomainError('STALE_WORK', 'The action plan or stage changed. Reload before saving.', 409);
      checkWorkChange(event.status, (previous?.actions ?? []) as unknown as OpportunityAction[], data.actions);
      const owners = await this.workOwners(tx, org, [
        data.ownerMembershipId,
        ...data.actions.map((a) => a.ownerMembershipId),
      ]);
      const actions = data.actions.map((a) => ({
        ...a,
        ownerLabel:
          owners.find((o) => o.id === a.ownerMembershipId)!.user.name ??
          owners.find((o) => o.id === a.ownerMembershipId)!.user.email,
      }));
      const work = await tx.opportunityWorkVersion.create({
        data: {
          organisationId: org,
          siteId,
          opportunityId: id,
          previousId: previous?.id,
          revision: (previous?.revision ?? 0) + 1,
          ownerMembershipId: data.ownerMembershipId,
          actions: json(actions),
          note: data.note,
          authorId: actor.userId,
          requestKey: data.requestKey,
          requestHash,
        },
      });
      await this.audit(tx, actor, org, 'opportunity.work_saved', id, {
        siteId,
        workVersionId: work.id,
        revision: work.revision,
        ownerMembershipId: work.ownerMembershipId,
      });
      return tx.opportunity.findUniqueOrThrow({ where: { id }, include });
    });
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
  async submitVerification(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    uuid.parse(id);
    const data = verificationInput.parse(input);
    const report = await this.report(actor, org, siteId, {
      family: 'savings',
      runId: data.runId,
      ...(data.carbonRunId ? { carbonRunId: data.carbonRunId } : {}),
    });
    const requestHash = snapshotHash({ siteId, id, actorId: actor.userId, ...data });
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.opportunityAccess(tx, actor, org, siteId, true);
        const opportunity = await tx.opportunity.findFirst({ where: { id, organisationId: org, siteId }, include });
        if (!opportunity) throw new DomainError('NOT_FOUND', 'This opportunity is not available.', 404);
        const retry = await tx.opportunityVerification.findUnique({
          where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
        });
        if (retry) {
          if (retry.requestHash !== requestHash)
            throw new DomainError(
              'REQUEST_CONFLICT',
              'This request key was used for different verification evidence.',
              409,
            );
          return opportunity;
        }
        const event = opportunity.events.at(-1)!;
        const work = opportunity.workVersions.at(-1);
        const previous = opportunity.verifications.at(-1);
        if (event.id !== data.eventId || work?.id !== data.workVersionId || (previous?.id ?? null) !== data.previousId)
          throw new DomainError(
            'STALE_VERIFICATION',
            'The opportunity or verification evidence changed. Reload before submitting.',
            409,
          );
        if (!['IMPLEMENTED', 'VERIFICATION'].includes(event.status))
          throw new DomainError(
            'VERIFICATION_STAGE',
            'Complete implementation before submitting verification evidence.',
            409,
          );
        const candidate = await tx.analysisRun.findFirst({
          where: { id: data.runId, organisationId: org, siteId, meterId: opportunity.meterId },
        });
        const original = await tx.analysisRun.findUniqueOrThrow({ where: { id: opportunity.runId } });
        if (!candidate || candidate.baselineId !== original.baselineId || candidate.id === original.id)
          throw new DomainError(
            'VERIFICATION_SCOPE',
            'Select a new saved reporting run for the same meter and exact baseline version.',
          );
        checkVerificationPeriod(opportunity.evidence as unknown as AnalyticsReport, report, data.implementationDate);
        const verification = await tx.opportunityVerification.create({
          data: {
            organisationId: org,
            siteId,
            opportunityId: id,
            meterId: opportunity.meterId,
            runId: candidate.id,
            workVersionId: work!.id,
            previousId: previous?.id,
            revision: (previous?.revision ?? 0) + 1,
            implementationDate: new Date(`${data.implementationDate}T00:00:00.000Z`),
            note: data.note,
            references: json(data.references),
            report: json(report),
            reportHash: reportFingerprint(report),
            eligibility: json(verificationEligibility(report)),
            authorId: actor.userId,
            requestKey: data.requestKey,
            requestHash,
          },
        });
        await tx.opportunityEvent.create({
          data: {
            organisationId: org,
            siteId,
            opportunityId: id,
            previousId: event.id,
            revision: event.revision + 1,
            status: 'VERIFICATION',
            workVersionId: work!.id,
            verificationId: verification.id,
            note: data.note,
            actorId: actor.userId,
            requestKey: data.requestKey,
            requestHash,
          },
        });
        await this.audit(tx, actor, org, 'opportunity.verification_submitted', id, {
          siteId,
          verificationId: verification.id,
          revision: verification.revision,
          reportHash: verification.reportHash,
        });
        return tx.opportunity.findUniqueOrThrow({ where: { id }, include });
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
      const member = await this.opportunityAccess(tx, actor, org, siteId, true);
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
      if (data.status === 'APPROVED' && !can(member.role, 'analysis:approve'))
        throw new DomainError('FORBIDDEN', 'Only owners and admins can approve an action plan.', 403);
      const work = opportunity.workVersions.at(-1);
      if ((data.workVersionId ?? null) !== (work?.id ?? null))
        throw new DomainError('STALE_WORK', 'The action plan changed. Reload before changing its stage.', 409);
      const previous = opportunity.events.at(-1)!;
      if (previous.id !== data.previousId)
        throw new DomainError('STALE_REVIEW', 'This investigation changed. Reload it before reviewing.', 409);
      const verification = opportunity.verifications.at(-1);
      if ((data.verificationId ?? null) !== (verification?.id ?? null))
        throw new DomainError('STALE_VERIFICATION', 'Verification evidence changed. Reload before reviewing.', 409);
      if (previous.status === 'VERIFICATION' && !can(member.role, 'analysis:approve'))
        throw new DomainError('FORBIDDEN', 'Only owners and admins can decide a verification outcome.', 403);
      checkOpportunityTransition(previous.status, data.status);
      if (data.status === 'VERIFIED') {
        if (!verification) throw new DomainError('VERIFICATION_REQUIRED', 'Submit verification evidence first.');
        requireVerifiedEligibility(verification.report as unknown as AnalyticsReport);
      }
      if (['APPROVED', 'IN_PROGRESS', 'IMPLEMENTED'].includes(data.status)) {
        if (!work) throw new DomainError('WORK_REQUIRED', 'Save an owner and action plan before approval.');
        const actions = work.actions as unknown as OpportunityAction[];
        if (!actions.length) throw new DomainError('WORK_REQUIRED', 'Add at least one action before approval.');
        await this.workOwners(tx, org, [work.ownerMembershipId, ...actions.map((a) => a.ownerMembershipId)]);
        if (
          data.status === 'IMPLEMENTED' &&
          actions.some((a) => a.status !== 'DONE' || a.completionEvidence.length < 10)
        )
          throw new DomainError(
            'WORK_INCOMPLETE',
            'Every action needs completion evidence before marking the opportunity implemented.',
          );
      }
      await tx.opportunityEvent.create({
        data: {
          organisationId: org,
          siteId,
          opportunityId: id,
          previousId: previous.id,
          workVersionId: work?.id,
          verificationId: verification?.id,
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
