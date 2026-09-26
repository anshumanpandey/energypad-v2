import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { reportInput, type AnalyticsReport } from '../domain/analytics-report';
import { AnalyticsReportService, reportFingerprint } from './analytics-reports';
import { snapshotHash } from './analysis/contract';
const captureInput = z
  .object({ definition: reportInput, fingerprint: z.string().regex(/^[a-f0-9]{64}$/), requestKey: z.uuid() })
  .strict();
export class ReportArchiveService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, write = false) {
    const member = await this.membership(actor, org, write ? 'analysis:write' : undefined, tx);
    const site = await tx.site.findFirst({
      where: {
        id: uuid.parse(siteId),
        organisationId: org,

        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
          : {}),
      },
    });
    if (!site) throw new DomainError('NOT_FOUND', 'This report archive is unavailable.', 404);
  }
  async capture(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = captureInput.parse(input);
    const requestHash = snapshotHash({ authorId: actor.userId, org, siteId, ...data });
    const checkRetry = (row: { requestHash: string } | null) => {
      if (row && row.requestHash !== requestHash)
        throw new DomainError('REQUEST_CONFLICT', 'This archive request key was used for different evidence.', 409);
    };
    const prior = await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, true);
      const row = await tx.reportArchive.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      checkRetry(row);
      return row;
    });
    if (prior) return { id: prior.id, fingerprint: prior.fingerprint };
    const generator = new AnalyticsReportService(
      this.db,
      {
        async send() {
          throw new Error('Mail disabled');
        },
      },
      'http://localhost',
    );
    const report = await generator.report(actor, org, siteId, data.definition);
    if (reportFingerprint(report) !== data.fingerprint)
      throw new DomainError(
        'REPORT_CHANGED',
        'Report inputs changed. Preview again before retaining this report.',
        409,
      );
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.access(tx, actor, org, siteId, true);
      const retry = await tx.reportArchive.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
      });
      checkRetry(retry);
      if (retry) return { id: retry.id, fingerprint: retry.fingerprint };
      const archive = await tx.reportArchive.create({
        data: {
          organisationId: org,
          siteId,
          authorId: actor.userId,
          family: report.family,
          definition: data.definition,
          report: JSON.parse(JSON.stringify(report)),
          fingerprint: data.fingerprint,
          requestKey: data.requestKey,
          requestHash,
        },
      });
      await this.audit(tx, actor, org, 'report.archived', archive.id, {
        siteId,
        family: report.family,
        fingerprint: archive.fingerprint,
      });
      return { id: archive.id, fingerprint: archive.fingerprint };
    });
  }
  async history(actor: Actor, org: string, siteId: string, cursor?: string) {
    if (cursor) uuid.parse(cursor);
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId);
        const scope = { organisationId: org, siteId };
        const anchor = cursor ? await tx.reportArchive.findFirst({ where: { ...scope, id: cursor } }) : null;
        if (cursor && !anchor) throw new DomainError('NOT_FOUND', 'This archive cursor is unavailable.', 404);
        const rows = await tx.reportArchive.findMany({
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
          select: { id: true, family: true, createdAt: true, fingerprint: true },
        });
        return { items: rows.slice(0, 25), nextCursor: rows.length > 25 ? rows[24].id : null };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async read(actor: Actor, org: string, siteId: string, id: string) {
    uuid.parse(id);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const archive = await tx.reportArchive.findFirst({ where: { id, organisationId: org, siteId } });
      if (!archive) throw new DomainError('NOT_FOUND', 'This report archive is unavailable.', 404);
      const report = archive.report as unknown as AnalyticsReport;
      if (reportFingerprint(report) !== archive.fingerprint)
        throw new DomainError('REPORT_INTEGRITY', 'Retained report integrity check failed.', 500);
      await this.audit(tx, actor, org, 'report.archive_downloaded', archive.id, {
        siteId,
        fingerprint: archive.fingerprint,
      });
      return report;
    });
  }
}
