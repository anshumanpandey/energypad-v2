import type { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from '../foundation';
import { previewLegacyTariffs } from './tariff-preview';
export class LegacyTariffPreflight extends FoundationService {
  async preview(actor: Actor, org: string, input: unknown) {
    // Read-only permissions and snapshot. No audit or business records are written.
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await this.membership(actor, org, 'organisation:update', tx);
        return this.check(tx, org, input);
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
  protected async check(tx: Prisma.TransactionClient, org: string, input: unknown) {
    const report = previewLegacyTariffs(input);
    const conflicts: { key: string; code: string }[] = [];
    for (const siteId of new Set(report.decisions.sites.map((s) => s.targetSiteId))) {
      if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
        conflicts.push({ key: siteId, code: 'SITE_UNAVAILABLE' });
    }
    for (const c of report.plan.catalogs) {
      if (
        await tx.energyCatalogVersion.findFirst({
          where: {
            organisationId: org,
            kind: c.input.kind,
            OR: [{ code: c.input.code }, { legacySource: c.input.legacySource, legacyId: c.input.legacyId }],
          },
        })
      )
        conflicts.push({ key: c.key, code: 'CATALOG_ALREADY_PRESENT' });
    }
    for (const u of report.plan.siteUses) {
      if (
        await tx.siteEnergyUse.findFirst({
          where: {
            organisationId: org,
            siteId: u.siteId,
            OR: [
              { code: u.input.code },
              {
                legacySource: u.input.legacySource,
                fuelLegacyId: u.input.fuelLegacyId,
                endUseLegacyId: u.input.endUseLegacyId,
              },
            ],
          },
        })
      )
        conflicts.push({ key: u.key, code: 'SITE_USE_ALREADY_PRESENT' });
    }
    // Matching existing destinations is intentionally a conflict, not a silent overwrite or skip.
    return {
      ...report,
      organisationId: org,
      targetCheckedAt: new Date().toISOString(),
      targetConflicts: conflicts,
      ready: report.ready && !conflicts.length,
    };
  }
}
