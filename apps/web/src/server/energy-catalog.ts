import { FoundationService, type Actor } from './foundation';
import { catalogInput, catalogCorrectionInput } from '../domain/energy-catalog';
import { DomainError, uuid } from '../domain/policy';
export class EnergyCatalogService extends FoundationService {
  async list(actor: Actor, org: string, siteId: string) {
    await this.getSite(actor, org, siteId);
    return this.db.energyCatalogVersion.findMany({
      where: { organisationId: org, replacement: { is: null } },
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown, supersedesId?: string, reason?: string) {
    const data = catalogInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      if (!(await tx.site.findFirst({ where: { id: uuid.parse(siteId), organisationId: org, archivedAt: null } })))
        throw new DomainError('NOT_FOUND', 'This active site is unavailable.', 404);
      const previous = supersedesId
        ? await tx.energyCatalogVersion.findFirst({
            where: { id: uuid.parse(supersedesId), organisationId: org, replacement: { is: null } },
          })
        : null;
      if (supersedesId && !previous)
        throw new DomainError('STALE_REVISION', 'This catalog entry changed or is unavailable. Reload it.', 409);
      if (
        previous &&
        (['kind', 'code', 'fuel', 'legacySource', 'legacyId'] as const).some((k) => previous[k] !== data[k])
      )
        throw new DomainError('IDENTITY', 'Keep the catalog kind, code, fuel and legacy identity fixed.');
      if (
        !previous &&
        (await tx.energyCatalogVersion.findFirst({
          where: {
            organisationId: org,
            kind: data.kind,
            OR: [
              { code: data.code },
              ...(data.legacyId ? [{ legacySource: data.legacySource, legacyId: data.legacyId }] : []),
            ],
          },
        }))
      )
        throw new DomainError('CATALOG_CONFLICT', 'This catalog code or source identity is already registered.', 409);
      const record = await tx.energyCatalogVersion.create({
        data: {
          ...data,
          organisationId: org,
          authorId: actor.userId,
          ...(previous ? { supersedesId: previous.id, revision: previous.revision + 1, correctionReason: reason } : {}),
        },
      });
      await this.audit(tx, actor, org, previous ? 'energy.catalog_corrected' : 'energy.catalog_added', record.id, {
        kind: data.kind,
        code: data.code,
        ...(previous ? { supersedesId: previous.id, reason, revision: record.revision } : {}),
      });
      return record;
    });
  }
  async correct(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { entry, reason } = catalogCorrectionInput.parse(input);
    return this.add(actor, org, siteId, entry, id, reason);
  }
  async history(actor: Actor, org: string, siteId: string, id: string) {
    await this.getSite(actor, org, siteId);
    const selected = await this.db.energyCatalogVersion.findFirst({
      where: { id: uuid.parse(id), organisationId: org },
    });
    if (!selected) throw new DomainError('NOT_FOUND', 'This catalog entry is unavailable.', 404);
    return this.db.energyCatalogVersion.findMany({
      where: { organisationId: org, kind: selected.kind, code: selected.code },
      orderBy: { revision: 'desc' },
    });
  }
}
