import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { energyUseInput, tariffInput, tariffCorrectionInput } from '../domain/tariffs';
export class TariffService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string) {
    uuid.parse(siteId);
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
    if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This active site is not available.', 404);
  }
  async list(actor: Actor, org: string, siteId: string) {
    await this.getSite(actor, org, siteId);
    return {
      uses: await this.db.siteEnergyUse.findMany({ where: { organisationId: org, siteId }, orderBy: { code: 'asc' } }),
      tariffs: await this.db.tariffVersion.findMany({
        where: { organisationId: org, siteId, replacement: { is: null } },
        orderBy: { validFrom: 'desc' },
      }),
    };
  }
  async addUse(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = energyUseInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      if (
        await tx.siteEnergyUse.findFirst({
          where: {
            organisationId: org,
            siteId,
            OR: [
              { code: data.code },
              ...(data.associationLegacyId
                ? [
                    {
                      legacySource: data.legacySource,
                      associationLegacyTable: data.associationLegacyTable,
                      associationLegacyId: data.associationLegacyId,
                    },
                  ]
                : []),
              ...(data.endUseLegacyId && data.fuelLegacyId
                ? [
                    {
                      legacySource: data.legacySource,
                      endUseLegacyId: data.endUseLegacyId,
                      fuelLegacyId: data.fuelLegacyId,
                    },
                  ]
                : []),
            ],
          },
        })
      )
        throw new DomainError(
          'USE_CONFLICT',
          'This code or legacy association is already registered for the site.',
          409,
        );

      for (const [id, kind] of [
        [data.fuelCatalogId, 'FUEL'],
        [data.endUseCatalogId, 'END_USE'],
      ] as const) {
        if (!id) continue;
        const entry = await tx.energyCatalogVersion.findFirst({
          where: { id, organisationId: org, kind, fuel: data.fuel, retired: false, replacement: { is: null } },
        });
        if (!entry)
          throw new DomainError('CATALOG_UNAVAILABLE', 'Choose a current catalog entry matching this fuel.', 409);
        const legacyId = kind === 'FUEL' ? data.fuelLegacyId : data.endUseLegacyId;
        if (legacyId && (entry.legacySource !== data.legacySource || entry.legacyId !== legacyId))
          throw new DomainError('CATALOG_IDENTITY', 'The catalog entry and legacy reference must agree.');
      }
      const record = await tx.siteEnergyUse.create({
        data: { ...data, organisationId: org, siteId, authorId: actor.userId },
      });
      await this.audit(tx, actor, org, 'energy.use_added', record.id, { siteId, code: record.code });
      return record;
    });
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown, supersedesId?: string, reason?: string) {
    const data = tariffInput.parse(input);
    const validFrom = new Date(data.firstDay),
      validUntil = new Date(+new Date(data.lastDay) + 86400000);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const use = await tx.siteEnergyUse.findFirst({ where: { id: data.energyUseId, organisationId: org, siteId } });
      if (!use) throw new DomainError('NOT_FOUND', 'This site end use is not available.', 404);
      const previous = supersedesId
        ? await tx.tariffVersion.findFirst({
            where: { id: uuid.parse(supersedesId), organisationId: org, siteId, replacement: { is: null } },
          })
        : null;
      if (supersedesId && !previous)
        throw new DomainError(
          'STALE_REVISION',
          'This tariff changed or is unavailable. Reload before correcting it.',
          409,
        );
      if (previous && previous.energyUseId !== data.energyUseId)
        throw new DomainError('IDENTITY', 'A tariff correction must keep its site end use.');
      if (
        await tx.tariffVersion.findFirst({
          where: {
            organisationId: org,
            siteId,
            energyUseId: data.energyUseId,
            replacement: { is: null },
            validFrom: { lt: validUntil },
            validUntil: { gt: validFrom },
            ...(previous ? { id: { not: previous.id } } : {}),
          },
        })
      )
        throw new DomainError(
          'TARIFF_OVERLAP',
          'Another current tariff covers part of these dates for this end use.',
          409,
        );
      const { firstDay: _first, lastDay: _last, bands, ...fields } = data;
      void _first;
      void _last;
      const record = await tx.tariffVersion.create({
        data: {
          ...fields,
          validFrom,
          validUntil,
          bands: bands as Prisma.InputJsonValue,
          organisationId: org,
          siteId,
          authorId: actor.userId,
          ...(previous ? { supersedesId: previous.id, revision: previous.revision + 1, correctionReason: reason } : {}),
        },
      });
      await this.audit(tx, actor, org, previous ? 'energy.tariff_corrected' : 'energy.tariff_added', record.id, {
        siteId,
        energyUseId: use.id,
        ...(previous ? { supersedesId: previous.id, reason, revision: record.revision } : {}),
      });
      return record;
    });
  }
  async correct(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { tariff, reason } = tariffCorrectionInput.parse(input);
    return this.add(actor, org, siteId, tariff, id, reason);
  }
  async history(actor: Actor, org: string, siteId: string, id: string) {
    uuid.parse(id);
    await this.getSite(actor, org, siteId);
    const selected = await this.db.tariffVersion.findFirst({ where: { id, organisationId: org, siteId } });
    if (!selected) throw new DomainError('NOT_FOUND', 'This tariff is not available.', 404);
    const rows = await this.db.tariffVersion.findMany({
      where: { organisationId: org, siteId, energyUseId: selected.energyUseId },
    });
    let root = selected;
    while (root.supersedesId) root = rows.find((r) => r.id === root.supersedesId)!;
    const result = [root];
    let next = rows.find((r) => r.supersedesId === root.id);
    while (next) {
      result.push(next);
      next = rows.find((r) => r.supersedesId === next!.id);
    }
    return result.reverse();
  }
}
