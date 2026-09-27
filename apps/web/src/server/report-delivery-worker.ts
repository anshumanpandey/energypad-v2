import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ReportDeliveryEligibilityService } from './report-delivery-eligibility';
import type { Actor, Mailer } from './foundation';
import { DomainError, uuid } from '../domain/policy';

/** Readiness rehearsal only. No email transport or automatic scheduler is connected. */
export class ReportDeliveryWorker extends ReportDeliveryEligibilityService {
  constructor(
    db: PrismaClient,
    mail: Mailer,
    url: string,
    private clock: () => Date = () => new Date(),
  ) {
    super(db, mail, url);
  }
  private async scoped(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, jobId: string) {
    const job = await tx.reportDeliveryJob.findFirst({
      where: { id: jobId, organisationId: org, siteId, revision: { schedule: { owner: { userId: actor.userId } } } },
      include: { revision: true },
    });
    if (!job) throw new DomainError('NOT_FOUND', 'This report job is unavailable.', 404);
    return job;
  }
  async claim(actor: Actor, org: string, siteId: string, jobId: string, requestKey: string) {
    [siteId, jobId, requestKey].forEach((id) => uuid.parse(id));
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'analysis:write', tx);
      const job = await this.scoped(tx, actor, org, siteId, jobId);
      const now = this.clock();
      // Persist interrupted evidence before retrying; never treat an abandoned check as a send.
      const expired = await tx.reportDeliveryCheck.findFirst({
        where: { jobId, status: 'CHECKING', leaseUntil: { lte: now } },
      });
      if (expired) {
        await tx.reportDeliveryCheck.update({
          where: { id: expired.id },
          data: { status: 'INTERRUPTED', code: 'LEASE_EXPIRED_NO_SEND', finishedAt: now },
        });
        await this.audit(tx, actor, org, 'report.delivery_check_interrupted', expired.id, { jobId });
      }
      const prior = await tx.reportDeliveryCheck.findUnique({ where: { jobId_requestKey: { jobId, requestKey } } });
      if (prior) return { claimed: false as const, check: prior };
      if (job.status !== 'HELD') return { claimed: false as const, reason: 'JOB_CANCELLED' as const };
      if (job.occurrenceAt > now) return { claimed: false as const, reason: 'NOT_DUE' as const };
      const active = await tx.reportDeliveryCheck.findFirst({ where: { jobId, status: 'CHECKING' } });
      if (active) return { claimed: false as const, reason: 'BUSY' as const };
      const last = await tx.reportDeliveryCheck.findFirst({ where: { jobId }, orderBy: { attempt: 'desc' } });
      const check = await tx.reportDeliveryCheck.create({
        data: {
          jobId,
          requestKey,
          attempt: (last?.attempt ?? 0) + 1,
          token: randomUUID(),
          startedAt: now,
          leaseUntil: new Date(now.getTime() + 120_000),
        },
      });
      await this.audit(tx, actor, org, 'report.delivery_check_claimed', check.id, { jobId, attempt: check.attempt });
      return { claimed: true as const, check };
    });
  }
  async complete(actor: Actor, org: string, siteId: string, jobId: string, token: string) {
    [siteId, jobId, token].forEach((id) => uuid.parse(id));
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      const job = await this.scoped(tx, actor, org, siteId, jobId);
      const check = await tx.reportDeliveryCheck.findFirst({ where: { jobId, token } });
      if (!check) throw new DomainError('NOT_FOUND', 'This delivery check is unavailable.', 404);
      // Token permits finalization of this claimed check, not any report/recipient data read.
      if (check.status !== 'CHECKING') return { status: 'STALE_CLAIM' as const, delivery: 'DISABLED' as const };
      const now = this.clock();
      let status: 'READY_NO_SEND' | 'BLOCKED' | 'INTERRUPTED' = 'READY_NO_SEND';
      let code = 'ELIGIBLE_NO_SEND';
      if (check.leaseUntil <= now) {
        status = 'INTERRUPTED';
        code = 'LEASE_EXPIRED_NO_SEND';
      } else {
        const latest = await tx.reportScheduleRevision.findFirstOrThrow({
          where: { scheduleId: job.scheduleId },
          orderBy: { revision: 'desc' },
        });
        if (job.status !== 'HELD' || latest.id !== job.revisionId || latest.state !== 'DRAFT') {
          status = 'BLOCKED';
          code = 'SCHEDULE_CHANGED';
        } else {
          try {
            await this.checkInTransaction(tx, actor, org, siteId, {
              archiveId: job.revision.archiveId,
              fingerprint: job.revision.fingerprint,
              recipientMembershipIds: job.revision.recipientMembershipIds,
            });
          } catch (error) {
            // Unexpected database errors roll back and remain recoverable after lease expiry.
            if (!(error instanceof DomainError)) throw error;
            status = 'BLOCKED';
            code = error.code;
          }
        }
      }
      const finishedAt = this.clock();
      if (check.leaseUntil <= finishedAt) {
        status = 'INTERRUPTED';
        code = 'LEASE_EXPIRED_NO_SEND';
      }
      await tx.reportDeliveryCheck.update({ where: { id: check.id }, data: { status, code, finishedAt } });
      await this.audit(tx, actor, org, 'report.delivery_check_finished', check.id, { jobId, status, code });
      return { status, code, delivery: 'DISABLED' as const };
    });
  }
  async execute(actor: Actor, org: string, siteId: string, scheduleId: string, jobId: string, input: unknown) {
    const { requestKey } = z.object({ requestKey: z.uuid() }).strict().parse(input);
    [siteId, scheduleId, jobId].forEach((id) => uuid.parse(id));
    await this.membership(actor, org, 'analysis:write');
    const job = await this.db.reportDeliveryJob.findFirst({
      where: { id: jobId, organisationId: org, siteId, scheduleId },
    });
    if (!job) throw new DomainError('NOT_FOUND', 'This report job is unavailable.', 404);
    const result = await this.run(actor, org, siteId, jobId, requestKey);
    // A worker may retain a blocked outcome after revocation, but HTTP cannot expose it to a revoked member.
    await this.membership(actor, org);
    if ('check' in result && result.check)
      return { delivery: 'DISABLED' as const, status: result.check.status, code: result.check.code };
    if ('reason' in result) return { delivery: 'DISABLED' as const, status: result.reason };
    if ('status' in result)
      return {
        delivery: 'DISABLED' as const,
        status: result.status,
        ...('code' in result ? { code: result.code } : {}),
      };
    throw new Error('Unexpected readiness result');
  }
  async run(actor: Actor, org: string, siteId: string, jobId: string, requestKey: string) {
    const result = await this.claim(actor, org, siteId, jobId, requestKey);
    if (!result.claimed) return { ...result, delivery: 'DISABLED' as const };
    return this.complete(actor, org, siteId, jobId, result.check.token);
  }
}
