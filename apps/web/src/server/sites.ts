import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { resolvePlanAccess, requireSiteCapacity } from '../domain/plan-access';
import { DomainError, uuid } from '../domain/policy';
import {
  siteInput,
  attributesInput,
  portfolioInput,
  meterInput,
  mappingInput,
  type ImportSheet,
  type SiteInput,
} from '../domain/sites';
import { previewRows, readWorkbook } from './workbook';
type Tx = Prisma.TransactionClient;
const missing = () => new DomainError('NOT_FOUND', 'This resource is not available.', 404);
export class SiteService extends FoundationService {
  private async writeAccess(tx: Tx, actor: Actor, org: string) {
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
  }
  private async ownedSite(tx: Tx, org: string, id: string) {
    const site = await tx.site.findFirst({ where: { id: uuid.parse(id), organisationId: org, archivedAt: null } });
    if (!site) throw missing();
    return site;
  }
  private async validatePortfolio(tx: Tx, org: string, id: string | null) {
    if (id && !(await tx.portfolio.findFirst({ where: { id, organisationId: org, archivedAt: null } })))
      throw missing();
  }
  private async capacity(tx: Tx, org: string, amount: number) {
    const organisation = await tx.organisation.findUniqueOrThrow({ where: { id: org }, include: { plan: true } });
    const count = await tx.site.count({ where: { organisationId: org, archivedAt: null } });
    requireSiteCapacity(resolvePlanAccess(organisation), count, amount);
  }
  private async insertSite(tx: Tx, actor: Actor, org: string, data: SiteInput, batchId?: string) {
    const { attributes, ...fields } = data;
    await this.validatePortfolio(tx, org, fields.portfolioId);
    const site = await tx.site.create({ data: { ...fields, organisationId: org } });
    if (attributes)
      await tx.siteAttributeHistory.create({
        data: {
          ...attributes,
          effectiveFrom: new Date(attributes.effectiveFrom),
          siteId: site.id,
          organisationId: org,
          authorId: actor.userId,
          importBatchId: batchId,
        },
      });
    await this.audit(tx, actor, org, 'site.created', site.id, { ...(batchId ? { batchId } : {}) });
    return site;
  }
  async siteDetail(actor: Actor, org: string, id: string) {
    await this.getSite(actor, org, id);
    return this.db.site.findFirstOrThrow({
      where: { id, organisationId: org },
      include: {
        portfolio: true,
        attributes: { orderBy: { effectiveFrom: 'desc' } },
        meters: { where: { archivedAt: null }, orderBy: { code: 'asc' } },
      },
    });
  }
  async createSite(actor: Actor, org: string, input: unknown) {
    const data = siteInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.capacity(tx, org, 1);
      return this.insertSite(tx, actor, org, data);
    });
  }
  async updateSite(actor: Actor, org: string, id: string, input: unknown) {
    const { attributes, ...data } = siteInput.parse(input);
    if (attributes) throw new DomainError('HISTORY_REQUIRED', 'Add attribute changes through a new history entry.');
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.ownedSite(tx, org, id);
      await this.validatePortfolio(tx, org, data.portfolioId);
      const site = await tx.site.update({ where: { id }, data });
      await this.audit(tx, actor, org, 'site.updated', id);
      return site;
    });
  }
  async archiveSite(actor: Actor, org: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.ownedSite(tx, org, id);
      await tx.site.update({ where: { id }, data: { archivedAt: new Date() } });
      await tx.siteAssignment.deleteMany({ where: { siteId: id, organisationId: org } });
      await tx.invitationSite.deleteMany({ where: { siteId: id, organisationId: org } });
      await this.audit(tx, actor, org, 'site.archived', id);
      return { archived: true };
    });
  }
  async addAttributes(actor: Actor, org: string, id: string, input: unknown) {
    const data = attributesInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.ownedSite(tx, org, id);
      const history = await tx.siteAttributeHistory.create({
        data: {
          ...data,
          effectiveFrom: new Date(data.effectiveFrom),
          siteId: id,
          organisationId: org,
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'site.attributes_added', id, { historyId: history.id });
      return history;
    });
  }
  async portfolios(actor: Actor, org: string) {
    const sites = await this.listSites(actor, org);
    const member = await this.membership(actor, org);
    return this.db.portfolio.findMany({
      where: {
        organisationId: org,
        archivedAt: null,
        ...(member.role === 'SITE_MANAGER' ? { sites: { some: { id: { in: sites.map((s) => s.id) } } } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }
  async savePortfolio(actor: Actor, org: string, input: unknown, id?: string) {
    const data = portfolioInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      if (id) await this.validatePortfolio(tx, org, uuid.parse(id));
      const result = id
        ? await tx.portfolio.update({ where: { id }, data })
        : await tx.portfolio.create({ data: { ...data, organisationId: org } });
      await this.audit(tx, actor, org, id ? 'portfolio.updated' : 'portfolio.created', result.id);
      return result;
    });
  }
  async archivePortfolio(actor: Actor, org: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.validatePortfolio(tx, org, uuid.parse(id));
      if (await tx.site.count({ where: { portfolioId: id, organisationId: org, archivedAt: null } }))
        throw new DomainError('PORTFOLIO_IN_USE', 'Move or archive this portfolio’s sites first.', 409);
      await tx.portfolio.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.audit(tx, actor, org, 'portfolio.archived', id);
      return { archived: true };
    });
  }
  async saveMeter(actor: Actor, org: string, siteId: string, input: unknown, id?: string) {
    const data = meterInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.ownedSite(tx, org, siteId);
      if (
        id &&
        !(await tx.meter.findFirst({ where: { id: uuid.parse(id), siteId, organisationId: org, archivedAt: null } }))
      )
        throw missing();
      const result = id
        ? await tx.meter.update({ where: { id }, data })
        : await tx.meter.create({ data: { ...data, siteId, organisationId: org } });
      await this.audit(tx, actor, org, id ? 'meter.updated' : 'meter.created', result.id);
      return result;
    });
  }
  async archiveMeter(actor: Actor, org: string, siteId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      await this.ownedSite(tx, org, siteId);
      if (!(await tx.meter.findFirst({ where: { id: uuid.parse(id), siteId, organisationId: org, archivedAt: null } })))
        throw missing();
      await tx.meter.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.audit(tx, actor, org, 'meter.archived', id);
      return { archived: true };
    });
  }
  async upload(actor: Actor, org: string, bytes: Uint8Array) {
    await this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      const window = Math.floor(Date.now() / 3600000);
      const key = `upload:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    });
    const sheets = await readWorkbook(bytes);
    const fingerprint = createHash('sha256').update(JSON.stringify(sheets)).digest('hex');
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      const existing = await tx.importBatch.findUnique({
        where: { organisationId_fingerprint: { organisationId: org, fingerprint } },
      });
      if (existing) return existing;
      if (
        (await tx.importBatch.count({
          where: { organisationId: org, createdAt: { gt: new Date(Date.now() - 3600000) } },
        })) >= 20
      )
        throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
      const batch = await tx.importBatch.create({
        data: { organisationId: org, createdBy: actor.userId, fingerprint, sheets: JSON.parse(JSON.stringify(sheets)) },
      });
      await this.audit(tx, actor, org, 'import.uploaded', batch.id);
      return batch;
    });
  }
  async imports(actor: Actor, org: string) {
    await this.membership(actor, org, 'organisation:update');
    return this.db.importBatch.findMany({
      where: { organisationId: org },
      select: { id: true, status: true, createdAt: true, committedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
  async importDetail(actor: Actor, org: string, id: string) {
    await this.membership(actor, org, 'organisation:update');
    const batch = await this.db.importBatch.findFirst({ where: { id: uuid.parse(id), organisationId: org } });
    if (!batch) throw missing();
    return batch;
  }
  private async preview(tx: Tx, org: string, sheets: ImportSheet[], input: unknown) {
    const mapping = mappingInput.parse(input),
      result = previewRows(sheets, mapping);
    const existing = await tx.site.findMany({
      where: { organisationId: org, code: { in: result.records.map((r) => r.data.code) } },
      select: { code: true },
    });
    const codes = new Set(existing.map((s) => s.code));
    for (const row of result.records)
      if (codes.has(row.data.code))
        result.issues.push({
          row: row.row,
          field: 'code',
          message: 'Site code already exists, including archived records.',
        });
    return { ...result, mapping };
  }
  async mapImport(actor: Actor, org: string, id: string, input: unknown) {
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org);
      const batch = await tx.importBatch.findFirst({ where: { id: uuid.parse(id), organisationId: org } });
      if (!batch) throw missing();
      if (batch.status === 'COMMITTED')
        throw new DomainError('ALREADY_COMMITTED', 'This batch has already been imported.', 409);
      const result = await this.preview(tx, org, batch.sheets as unknown as ImportSheet[], input);
      return tx.importBatch.update({
        where: { id },
        data: {
          mapping: JSON.parse(JSON.stringify(result.mapping)),
          result: JSON.parse(JSON.stringify({ records: result.records, issues: result.issues })),
          status: result.issues.length ? 'INVALID' : 'READY',
        },
      });
    });
  }
  async commitImport(actor: Actor, org: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.writeAccess(tx, actor, org);
        const batch = await tx.importBatch.findFirst({ where: { id: uuid.parse(id), organisationId: org } });
        if (!batch) throw missing();
        if (batch.status === 'COMMITTED') return batch;
        if (batch.status !== 'READY' || !batch.mapping)
          throw new DomainError(
            'IMPORT_NOT_READY',
            'Validate this batch and resolve its errors before importing.',
            409,
          );
        const result = await this.preview(tx, org, batch.sheets as unknown as ImportSheet[], batch.mapping);
        if (result.issues.length)
          throw new DomainError(
            'IMPORT_CONFLICT',
            'The preview is no longer valid. Validate it again before importing.',
            409,
          );
        await this.capacity(tx, org, result.records.length);
        const siteIds = [];
        for (const row of result.records) siteIds.push((await this.insertSite(tx, actor, org, row.data, id)).id);
        await this.audit(tx, actor, org, 'import.committed', id, { count: siteIds.length });
        return tx.importBatch.update({
          where: { id },
          data: { status: 'COMMITTED', committedAt: new Date(), result: { siteIds, count: siteIds.length } },
        });
      },
      { timeout: 30000 },
    );
  }
}
