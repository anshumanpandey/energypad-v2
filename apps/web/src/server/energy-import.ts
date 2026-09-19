import { createHash } from 'node:crypto';
import { Prisma, type EnergyImportBatch } from '@prisma/client';
import { EnergyService } from './energy';
import type { Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { energyMappingInput, mapEnergyRows } from '../domain/energy-import';
import type { ImportSheet } from '../domain/sites';
import { readWorkbook } from './workbook';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class EnergyImportService extends EnergyService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string) {
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
  }
  private async batch(tx: Prisma.TransactionClient, org: string, siteId: string, id: string) {
    const batch = await tx.energyImportBatch.findFirst({ where: { id: uuid.parse(id), organisationId: org, siteId } });
    if (!batch) throw new DomainError('NOT_FOUND', 'This import is not available.', 404);
    return batch;
  }
  async list(actor: Actor, org: string, siteId: string) {
    await this.membership(actor, org, 'organisation:update');
    await this.getSite(actor, org, siteId);
    return this.db.energyImportBatch.findMany({
      where: { organisationId: org, siteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, meterId: true, status: true, createdAt: true },
    });
  }
  async detail(actor: Actor, org: string, siteId: string, id: string) {
    await this.membership(actor, org, 'organisation:update');
    return this.batch(this.db, org, siteId, id);
  }
  async upload(actor: Actor, org: string, siteId: string, meterId: string, bytes: Uint8Array) {
    uuid.parse(meterId);
    await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org);
      if (
        !(await tx.meter.findFirst({
          where: { id: meterId, siteId, organisationId: org, archivedAt: null, site: { archivedAt: null } },
        }))
      )
        throw new DomainError('NOT_FOUND', 'Choose an active meter in this site.', 404);
      const window = Math.floor(Date.now() / 3600000);
      const key = `energy-upload:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    });
    const sheets = await readWorkbook(bytes);
    const fingerprint = hash(sheets);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org);
      const existing = await tx.energyImportBatch.findUnique({
        where: { meterId_fingerprint: { meterId, fingerprint } },
      });
      if (existing) return existing;
      const batch = await tx.energyImportBatch.create({
        data: { organisationId: org, siteId, meterId, fingerprint, sheets: json(sheets), createdBy: actor.userId },
      });
      await this.audit(tx, actor, org, 'energy.import_uploaded', batch.id, { siteId, meterId });
      return batch;
    });
  }
  private async preview(tx: Prisma.TransactionClient, actor: Actor, batch: EnergyImportBatch, input: unknown) {
    const mapping = energyMappingInput.parse(input);
    const meter = await tx.meter.findFirst({
      where: {
        id: batch.meterId,
        organisationId: batch.organisationId,
        siteId: batch.siteId,
        archivedAt: null,
        site: { archivedAt: null },
      },
    });
    if (!meter) throw new DomainError('METER_ARCHIVED', 'Choose an active site and meter.');
    const mapped = mapEnergyRows(batch.sheets as unknown as ImportSheet[], mapping, meter.id, meter.unit);
    const rows = [];
    for (const row of mapped.records) {
      try {
        const prepared = await this.prepareReading(tx, actor, batch.organisationId, batch.siteId, row.data);
        // The importer may change; only domain inputs and derived values determine preview freshness.
        rows.push({ row: row.row, data: row.data, prepared: { ...prepared, authorId: undefined } });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        mapped.issues.push({ row: row.row, field: 'row', message: error.message });
      }
    }
    return { mapping, records: rows, issues: mapped.issues, signature: hash(rows) };
  }
  async map(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org);
        const batch = await this.batch(tx, org, siteId, id);
        if (batch.status === 'COMMITTED')
          throw new DomainError('COMMITTED', 'This workbook has already been imported.', 409);
        const result = await this.preview(tx, actor, batch, input);
        return tx.energyImportBatch.update({
          where: { id },
          data: {
            mapping: json(result.mapping),
            result: json(result),
            status: result.issues.length ? 'INVALID' : 'READY',
          },
        });
      },
      { timeout: 30000 },
    );
  }
  async commit(actor: Actor, org: string, siteId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org);
        const batch = await this.batch(tx, org, siteId, id);
        if (batch.status === 'COMMITTED') return batch;
        if (batch.status !== 'READY' || !batch.mapping)
          throw new DomainError('NOT_READY', 'Validate the workbook and resolve all errors first.', 409);
        const result = await this.preview(tx, actor, batch, batch.mapping);
        if (result.issues.length || result.signature !== (batch.result as { signature?: string } | null)?.signature)
          throw new DomainError(
            'STALE_PREVIEW',
            'The data or conversion context changed. Validate again before importing.',
            409,
          );
        const ids: string[] = [];
        for (const row of result.records) ids.push((await this.insertReading(tx, actor, org, siteId, row.data, id)).id);
        await this.audit(tx, actor, org, 'energy.import_committed', id, { siteId, count: ids.length });
        return tx.energyImportBatch.update({
          where: { id },
          data: { status: 'COMMITTED', committedAt: new Date(), result: { count: ids.length, recordIds: ids } },
        });
      },
      { timeout: 30000 },
    );
  }
}
