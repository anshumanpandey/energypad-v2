import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { Actor } from './foundation';
import { ReportDeliveryEligibilityService } from './report-delivery-eligibility';
import { DomainError, uuid } from '../domain/policy';
import { snapshotHash } from './analysis/contract';
const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Choose a valid time zone.')
  .transform((value) => new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone);
const saveInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('DRAFT'),
      requestKey: z.uuid(),
      scheduleId: z.uuid().optional(),
      expectedRevisionId: z.uuid().optional(),
      archiveId: z.uuid(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      recipientMembershipIds: z
        .array(z.uuid())
        .min(1)
        .max(100)
        .refine((ids) => new Set(ids).size === ids.length),
      timezone,
    })
    .strict()
    .refine(
      (v) => Boolean(v.scheduleId) === Boolean(v.expectedRevisionId),
      'Supply the current revision when editing a schedule.',
    ),
  z
    .object({ action: z.literal('CANCEL'), requestKey: z.uuid(), scheduleId: z.uuid(), expectedRevisionId: z.uuid() })
    .strict(),
]);
const occurrenceInput = z.object({ revisionId: z.uuid(), occurrenceAt: z.iso.datetime({ precision: 3 }) }).strict();

export const scheduleRevisionSelect = {
  id: true,
  scheduleId: true,
  previousId: true,
  revision: true,
  state: true,
  archiveId: true,
  fingerprint: true,
  recipientMembershipIds: true,
  timezone: true,
  createdAt: true,
} satisfies Prisma.ReportScheduleRevisionSelect;

// Draft management only. There is deliberately no activation or mail transport.
export class ReportScheduleService extends ReportDeliveryEligibilityService {
  private async owned(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, id: string) {
    const member = await this.membership(actor, org, undefined, tx);
    const schedule = await tx.reportSchedule.findFirst({
      where: { id, organisationId: org, siteId, ownerMembershipId: member.id },
    });
    if (!schedule) throw new DomainError('NOT_FOUND', 'This report schedule is unavailable.', 404);
    return schedule;
  }
  async list(actor: Actor, org: string, siteId: string, cursor?: string) {
    uuid.parse(siteId);
    if (cursor) uuid.parse(cursor);
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, org, undefined, tx);
        const scope = { organisationId: org, siteId, ownerMembershipId: member.id };
        const anchor = cursor ? await tx.reportSchedule.findFirst({ where: { ...scope, id: cursor } }) : null;
        if (cursor && !anchor) throw new DomainError('NOT_FOUND', 'This schedule cursor is unavailable.', 404);
        const rows = await tx.reportSchedule.findMany({
          where: {
            ...scope,
            ...(anchor
              ? {
                  OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 26,
          select: {
            id: true,
            createdAt: true,
            revisions: { orderBy: { revision: 'desc' }, take: 1, select: scheduleRevisionSelect },
          },
        });
        return {
          delivery: 'DISABLED' as const,
          items: rows.slice(0, 25).map(({ revisions, ...row }) => ({ ...row, latest: revisions[0] ?? null })),
          nextCursor: rows.length > 25 ? rows[24].id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async detail(actor: Actor, org: string, siteId: string, scheduleId: string) {
    uuid.parse(siteId);
    uuid.parse(scheduleId);
    return this.db.$transaction(
      async (tx) => {
        const schedule = await this.owned(tx, actor, org, siteId, scheduleId);
        const latest = await tx.reportScheduleRevision.findFirstOrThrow({
          where: { scheduleId },
          orderBy: { revision: 'desc' },
          select: scheduleRevisionSelect,
        });
        return { delivery: 'DISABLED' as const, id: schedule.id, createdAt: schedule.createdAt, latest };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async history(actor: Actor, org: string, siteId: string, scheduleId: string, cursor?: string) {
    uuid.parse(siteId);
    uuid.parse(scheduleId);
    if (cursor) uuid.parse(cursor);
    return this.db.$transaction(
      async (tx) => {
        await this.owned(tx, actor, org, siteId, scheduleId);
        const scope = { organisationId: org, siteId, scheduleId };
        const anchor = cursor ? await tx.reportScheduleRevision.findFirst({ where: { ...scope, id: cursor } }) : null;
        if (cursor && !anchor) throw new DomainError('NOT_FOUND', 'This revision cursor is unavailable.', 404);
        const rows = await tx.reportScheduleRevision.findMany({
          where: { ...scope, ...(anchor ? { revision: { lt: anchor.revision } } : {}) },
          orderBy: { revision: 'desc' },
          take: 26,
          select: scheduleRevisionSelect,
        });
        return {
          delivery: 'DISABLED' as const,
          items: rows.slice(0, 25),
          nextCursor: rows.length > 25 ? rows[24].id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async jobs(actor: Actor, org: string, siteId: string, scheduleId: string, cursor?: string) {
    uuid.parse(siteId);
    uuid.parse(scheduleId);
    if (cursor) uuid.parse(cursor);
    return this.db.$transaction(
      async (tx) => {
        await this.owned(tx, actor, org, siteId, scheduleId);
        const scope = { organisationId: org, siteId, scheduleId };
        const anchor = cursor ? await tx.reportDeliveryJob.findFirst({ where: { ...scope, id: cursor } }) : null;
        if (cursor && !anchor) throw new DomainError('NOT_FOUND', 'This job cursor is unavailable.', 404);
        const rows = await tx.reportDeliveryJob.findMany({
          where: {
            ...scope,
            ...(anchor
              ? {
                  OR: [
                    { occurrenceAt: { lt: anchor.occurrenceAt } },
                    { occurrenceAt: anchor.occurrenceAt, id: { gt: anchor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ occurrenceAt: 'desc' }, { id: 'asc' }],
          take: 26,
        });
        return {
          delivery: 'DISABLED' as const,
          items: rows.slice(0, 25),
          nextCursor: rows.length > 25 ? rows[24].id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async checks(actor: Actor, org: string, siteId: string, scheduleId: string, jobId: string, cursor?: string) {
    [siteId, scheduleId, jobId].forEach((id) => uuid.parse(id));
    if (cursor) uuid.parse(cursor);
    return this.db.$transaction(
      async (tx) => {
        await this.owned(tx, actor, org, siteId, scheduleId);
        const job = await tx.reportDeliveryJob.findFirst({
          where: { id: jobId, organisationId: org, siteId, scheduleId },
        });
        if (!job) throw new DomainError('NOT_FOUND', 'This report job is unavailable.', 404);
        const anchor = cursor ? await tx.reportDeliveryCheck.findFirst({ where: { id: cursor, jobId } }) : null;
        if (cursor && !anchor) throw new DomainError('NOT_FOUND', 'This check cursor is unavailable.', 404);
        const rows = await tx.reportDeliveryCheck.findMany({
          where: { jobId, ...(anchor ? { attempt: { lt: anchor.attempt } } : {}) },
          orderBy: { attempt: 'desc' },
          take: 26,
          select: {
            id: true,
            attempt: true,
            status: true,
            code: true,
            startedAt: true,
            finishedAt: true,
            leaseUntil: true,
          },
        });
        return {
          delivery: 'DISABLED' as const,
          jobId,
          checkedAt: new Date().toISOString(),
          items: rows.slice(0, 25),
          nextCursor: rows.length > 25 ? rows[24].id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async save(actor: Actor, org: string, siteId: string, input: unknown) {
    uuid.parse(siteId);
    const parsed = saveInput.parse(input);
    const data =
      parsed.action === 'DRAFT'
        ? { ...parsed, recipientMembershipIds: [...parsed.recipientMembershipIds].sort() }
        : parsed;
    const requestHash = snapshotHash({ org, siteId, ownerUserId: actor.userId, ...data });
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      const member = await this.membership(actor, org, data.action === 'DRAFT' ? 'analysis:write' : undefined, tx);
      const retry = await tx.reportScheduleRevision.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      if (retry) {
        await this.owned(tx, actor, org, siteId, retry.scheduleId);
        if (retry.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This schedule request key was used for another change.', 409);
        return retry;
      }
      const schedule = data.scheduleId ? await this.owned(tx, actor, org, siteId, data.scheduleId) : null;
      const previous = schedule
        ? await tx.reportScheduleRevision.findFirstOrThrow({
            where: { scheduleId: schedule.id },
            orderBy: { revision: 'desc' },
          })
        : null;
      if (previous && previous.id !== data.expectedRevisionId)
        throw new DomainError('SCHEDULE_CHANGED', 'Reload the latest schedule revision before editing.', 409);
      if (previous?.state === 'CANCELLED')
        throw new DomainError('SCHEDULE_CANCELLED', 'Create a new schedule instead of reopening a cancelled one.', 409);
      let definition;
      if (data.action === 'DRAFT') {
        const eligible = await this.checkInTransaction(tx, actor, org, siteId, {
          archiveId: data.archiveId,
          fingerprint: data.fingerprint,
          recipientMembershipIds: data.recipientMembershipIds,
        });
        definition = {
          archiveId: eligible.archiveId,
          fingerprint: eligible.fingerprint,
          recipientMembershipIds: eligible.recipientMembershipIds,
          timezone: data.timezone,
        };
      } else {
        // Cancellation remains available after downgrade, recipient revocation or site archival.
        if (!previous) throw new DomainError('NOT_FOUND', 'This report schedule is unavailable.', 404);
        definition = {
          archiveId: previous.archiveId,
          fingerprint: previous.fingerprint,
          recipientMembershipIds: previous.recipientMembershipIds,
          timezone: previous.timezone,
        };
      }
      const identity =
        schedule ??
        (await tx.reportSchedule.create({ data: { organisationId: org, siteId, ownerMembershipId: member.id } }));
      const revision = await tx.reportScheduleRevision.create({
        data: {
          scheduleId: identity.id,
          organisationId: org,
          siteId,
          revision: (previous?.revision ?? 0) + 1,
          previousId: previous?.id,
          state: data.action === 'CANCEL' ? 'CANCELLED' : 'DRAFT',
          ...definition,
          requestKey: data.requestKey,
          requestHash,
        },
      });
      // The database cancels older HELD jobs in the same transaction as this revision.
      await this.audit(tx, actor, org, 'report.schedule_revised', revision.id, {
        scheduleId: identity.id,
        revision: revision.revision,
        state: revision.state,
      });
      return revision;
    });
  }
  async prepareOccurrence(actor: Actor, org: string, siteId: string, scheduleId: string, input: unknown) {
    uuid.parse(siteId);
    uuid.parse(scheduleId);
    const data = occurrenceInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.owned(tx, actor, org, siteId, scheduleId);
      const revision = await tx.reportScheduleRevision.findFirstOrThrow({
        where: { scheduleId },
        orderBy: { revision: 'desc' },
      });
      if (revision.id !== data.revisionId || revision.state !== 'DRAFT')
        throw new DomainError('SCHEDULE_CHANGED', 'Only the current draft can prepare an occurrence.', 409);
      await this.checkInTransaction(tx, actor, org, siteId, {
        archiveId: revision.archiveId,
        fingerprint: revision.fingerprint,
        recipientMembershipIds: revision.recipientMembershipIds,
      });
      const occurrenceAt = new Date(data.occurrenceAt);
      const prior = await tx.reportDeliveryJob.findUnique({
        where: { revisionId_occurrenceAt: { revisionId: revision.id, occurrenceAt } },
      });
      if (prior) return prior;
      const job = await tx.reportDeliveryJob.create({
        data: { organisationId: org, siteId, scheduleId, revisionId: revision.id, occurrenceAt },
      });
      await this.audit(tx, actor, org, 'report.occurrence_prepared', job.id, {
        scheduleId,
        revisionId: revision.id,
        occurrenceAt: data.occurrenceAt,
        status: 'HELD',
      });
      return job;
    });
  }
}
