import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Actor } from '../foundation';
import { DomainError, uuid } from '../../domain/policy';
import { LegacyTariffPreflight } from './tariff-preflight';
import { previewLegacyTariffs } from './tariff-preview';

const approval = z.object({
  adapter: z.literal('legacy-tariff-preview-v1'),
  organisationId: uuid,
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  ready: z.literal(true),
});

export class LegacyTariffApply extends LegacyTariffPreflight {
  async apply(actor: Actor, org: string, input: unknown, reviewedReport: unknown) {
    const reviewed = approval.parse(reviewedReport);
    const source = previewLegacyTariffs(input);
    if (!source.ready || reviewed.organisationId !== org || reviewed.inputHash !== source.inputHash)
      throw new DomainError(
        'REVIEW_CHANGED',
        'The source or organisation differs from the ready reviewed report.',
        409,
      );
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const previous = await tx.legacyTariffBatch.findUnique({
          where: {
            organisationId_adapter_inputHash: {
              organisationId: org,
              adapter: source.adapter,
              inputHash: source.inputHash,
            },
          },
        });
        // A retry returns the immutable historical receipt, even if later corrections exist.
        if (previous) return { reused: true, batch: previous };
        const report = await this.check(tx, org, input);
        if (!report.ready)
          throw new DomainError(
            'TARGET_CHANGED',
            'The destination is unavailable or conflicts with this plan. Run a fresh preview.',
            409,
          );
        const targets: Record<string, string> = {};
        const base = { organisationId: org, authorId: actor.userId };
        for (const catalog of report.plan.catalogs) {
          const row = await tx.energyCatalogVersion.create({ data: { ...catalog.input, ...base } });
          targets[catalog.key] = row.id;
          await this.audit(tx, actor, org, 'energy.catalog_added', row.id, { migrationHash: source.inputHash });
        }
        for (const use of report.plan.siteUses) {
          const row = await tx.siteEnergyUse.create({
            data: {
              ...use.input,
              ...base,
              siteId: use.siteId,
              fuelCatalogId: targets[use.fuelKey],
              endUseCatalogId: targets[use.endUseKey],
            },
          });
          targets[use.key] = row.id;
          await this.audit(tx, actor, org, 'energy.use_added', row.id, { migrationHash: source.inputHash });
        }
        for (const tariff of report.plan.tariffs) {
          const { firstDay, lastDay, bands, ...fields } = tariff.input;
          const row = await tx.tariffVersion.create({
            data: {
              ...fields,
              ...base,
              siteId: tariff.siteId,
              energyUseId: targets[tariff.siteUseKey],
              validFrom: new Date(firstDay),
              validUntil: new Date(+new Date(lastDay) + 86400000),
              bands: bands as Prisma.InputJsonValue,
            },
          });
          targets[tariff.key] = row.id;
          await this.audit(tx, actor, org, 'energy.tariff_added', row.id, { migrationHash: source.inputHash });
        }
        const receipt = {
          plan: report.plan,
          decisions: report.decisions,
          reconciliation: report.reconciliation,
          ledger: report.ledger.map((row) => ({
            ...row,
            targetId: row.targetKey ? targets[row.targetKey] : undefined,
          })),
          targets,
        };
        const batch = await tx.legacyTariffBatch.create({
          data: {
            ...base,
            adapter: source.adapter,
            source: source.source,
            inputHash: source.inputHash,
            receipt: JSON.parse(JSON.stringify(receipt)) as Prisma.InputJsonValue,
          },
        });
        await this.audit(tx, actor, org, 'energy.legacy_tariffs_applied', batch.id, { inputHash: source.inputHash });
        return { reused: false, batch };
      },
      { timeout: 30000 },
    );
  }
}
