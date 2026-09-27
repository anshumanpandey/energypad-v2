import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { resolvePlanAccess } from '../domain/plan-access';
import type { AnalyticsReport } from '../domain/analytics-report';
import { reportFingerprint } from './analytics-reports';

// This bounds preflight work, not a commercial recipient allowance.
const inputSchema = z
  .object({
    archiveId: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    recipientMembershipIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each recipient only once.'),
  })
  .strict();

/** Internal read-only preflight. Its result is NOT a reusable delivery authorization. */
export class ReportDeliveryEligibilityService extends FoundationService {
  async check(actor: Actor, organisationId: string, siteId: string, input: unknown) {
    return this.db.$transaction((tx) => this.checkInTransaction(tx, actor, organisationId, siteId, input), {
      isolationLevel: 'RepeatableRead',
    });
  }
  protected async checkInTransaction(
    tx: Prisma.TransactionClient,
    actor: Actor,
    organisationId: string,
    siteId: string,
    input: unknown,
  ) {
    const data = inputSchema.parse(input);
    uuid.parse(siteId);
    // This actor is the proposed schedule owner, never an invented system user.
    await this.membership(actor, organisationId, 'analysis:write', tx);
    const organisation = await tx.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      include: { plan: true },
    });
    const access = resolvePlanAccess(organisation);
    if (!access.features.scheduledReports)
      throw new DomainError('REPORT_PLAN', 'The assigned plan does not include scheduled reports.', 403);
    const site = await tx.site.findFirst({ where: { id: siteId, organisationId, archivedAt: null } });
    if (!site) throw new DomainError('NOT_FOUND', 'This site is unavailable for scheduled reports.', 404);
    const archive = await tx.reportArchive.findFirst({
      where: { id: data.archiveId, organisationId, siteId },
    });
    if (!archive) throw new DomainError('NOT_FOUND', 'This report archive is unavailable.', 404);
    if (reportFingerprint(archive.report as unknown as AnalyticsReport) !== archive.fingerprint)
      throw new DomainError('REPORT_INTEGRITY', 'Retained report integrity check failed.', 500);
    if (archive.fingerprint !== data.fingerprint)
      throw new DomainError('REPORT_CHANGED', 'The selected archive fingerprint does not match.', 409);

    // Use membership IDs, never caller-provided email addresses or tenant metadata.
    const recipients = await tx.membership.findMany({
      where: {
        id: { in: data.recipientMembershipIds },
        organisationId,
        revokedAt: null,
        user: { OR: [{ emailVerified: { not: null } }, { passwordCredential: { isNot: null } }] },
        OR: [
          { role: { not: 'SITE_MANAGER' } },
          { role: 'SITE_MANAGER', siteAssignments: { some: { organisationId, siteId } } },
        ],
      },
      select: { id: true },
    });
    // All-or-nothing, with no disclosure of which foreign/revoked ID was supplied.
    if (recipients.length !== data.recipientMembershipIds.length)
      throw new DomainError('REPORT_RECIPIENT_ACCESS', 'One or more recipients cannot access this report.', 409);
    return {
      eligibility: 'ELIGIBLE_NOW' as const,
      delivery: 'DISABLED' as const,
      organisationId,
      siteId,
      archiveId: archive.id,
      fingerprint: archive.fingerprint,
      ownerUserId: actor.userId,
      recipientMembershipIds: recipients.map((r) => r.id).sort(),
      planAccessVersion: access.version,
      planSource: access.source,
    };
  }
}
