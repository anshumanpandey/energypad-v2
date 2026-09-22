import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { occupancyInput, occupancyCorrection, mapOccupancyWorkbook, type OccupancyPreview } from '../domain/occupancy';
import { readWorkbook } from './workbook';
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
export class OccupancyService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string) {
    uuid.parse(siteId);
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
    if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This active site is unavailable.', 404);
  }
  async list(actor: Actor, org: string, siteId: string, year: number) {
    await this.getSite(actor, org, siteId);
    if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new DomainError('YEAR', 'Choose a valid year.');
    return this.db.occupancyObservation.findMany({
      where: {
        organisationId: org,
        siteId,
        replacement: { is: null },
        validFrom: { lt: new Date(`${year + 1}-01-01`) },
        validUntil: { gt: new Date(`${year}-01-01`) },
      },
      include: { energyUse: true },
      orderBy: { validFrom: 'asc' },
    });
  }
  private async prepare(
    tx: Prisma.TransactionClient,
    org: string,
    siteId: string,
    input: unknown,
    supersedesId?: string,
  ) {
    const data = occupancyInput.parse(input);
    const use = await tx.siteEnergyUse.findFirst({ where: { organisationId: org, siteId, code: data.energyUseCode } });
    if (!use) throw new DomainError('END_USE', 'Choose a registered end use belonging to this site.');
    const { firstDay, lastDay, energyUseCode: _code, ...fields } = data;
    void _code;
    const record = {
      ...fields,
      organisationId: org,
      siteId,
      energyUseId: use.id,
      validFrom: new Date(firstDay),
      validUntil: new Date(+new Date(lastDay) + 86400000),
    };
    if (
      await tx.occupancyObservation.findFirst({
        where: {
          organisationId: org,
          siteId,
          energyUseId: use.id,
          replacement: { is: null },
          ...(supersedesId ? { id: { not: supersedesId } } : {}),
          validFrom: { lt: record.validUntil },
          validUntil: { gt: record.validFrom },
        },
      })
    )
      throw new DomainError(
        'OCCUPANCY_OVERLAP',
        'An occupancy record already covers part of these dates for this end use.',
        409,
      );
    if (
      !supersedesId &&
      data.legacyId &&
      (await tx.occupancyObservation.findFirst({
        where: { organisationId: org, legacySource: data.legacySource, legacyId: data.legacyId },
      }))
    )
      throw new DomainError('LEGACY_CONFLICT', 'This occupancy source identity has already been imported.', 409);
    return record;
  }
  private async insert(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    batchId?: string,
  ) {
    const data = await this.prepare(tx, org, siteId, input);
    const row = await tx.occupancyObservation.create({
      data: { ...data, authorId: actor.userId, importBatchId: batchId },
    });
    await this.audit(tx, actor, org, 'occupancy.recorded', row.id, { siteId, ...(batchId ? { batchId } : {}) });
    return row;
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown) {
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      return this.insert(tx, actor, org, siteId, input);
    });
  }
  async correct(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { observation, reason } = occupancyCorrection.parse(input);
    // prepare accepts wire-format counts, so keep the original validated request's strings.
    const wire = {
      ...observation,
      regularCount: observation.regularCount === null ? null : String(observation.regularCount),
      irregularCount: observation.irregularCount === null ? null : String(observation.irregularCount),
    };
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const prior = await tx.occupancyObservation.findFirst({
        where: { id: uuid.parse(id), organisationId: org, siteId, replacement: { is: null } },
      });
      if (!prior) throw new DomainError('STALE_REVISION', 'This record changed or is unavailable. Reload it.', 409);
      const data = await this.prepare(tx, org, siteId, wire, id);
      if (
        prior.energyUseId !== data.energyUseId ||
        +prior.validFrom !== +data.validFrom ||
        +prior.validUntil !== +data.validUntil ||
        prior.legacySource !== data.legacySource ||
        prior.legacyId !== data.legacyId
      )
        throw new DomainError('IDENTITY', 'Keep the period, end use and legacy identity fixed.');
      const row = await tx.occupancyObservation.create({
        data: {
          ...data,
          authorId: actor.userId,
          revision: prior.revision + 1,
          supersedesId: id,
          correctionReason: reason,
          importBatchId: prior.importBatchId,
        },
      });
      await this.audit(tx, actor, org, 'occupancy.corrected', row.id, { siteId, supersedesId: id, reason });
      return row;
    });
  }
  async history(actor: Actor, org: string, siteId: string, id: string) {
    await this.getSite(actor, org, siteId);
    const selected = await this.db.occupancyObservation.findFirst({
      where: { id: uuid.parse(id), organisationId: org, siteId },
    });
    if (!selected) throw new DomainError('NOT_FOUND', 'This record is unavailable.', 404);
    return this.db.occupancyObservation.findMany({
      where: {
        organisationId: org,
        siteId,
        energyUseId: selected.energyUseId,
        validFrom: selected.validFrom,
        validUntil: selected.validUntil,
      },
      orderBy: { revision: 'desc' },
    });
  }
  async imports(actor: Actor, org: string, siteId: string) {
    await this.membership(actor, org, 'organisation:update');
    await this.getSite(actor, org, siteId);
    return this.db.occupancyImportBatch.findMany({
      where: { organisationId: org, siteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
  async upload(actor: Actor, org: string, siteId: string, bytes: Uint8Array) {
    await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const window = Math.floor(Date.now() / 3600000),
        key = `occupancy-upload:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    });
    const sheets = await readWorkbook(bytes);
    const fingerprint = createHash('sha256').update(JSON.stringify(sheets)).digest('hex');
    const result = mapOccupancyWorkbook(sheets);
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId);
        const existing = await tx.occupancyImportBatch.findUnique({
          where: { siteId_fingerprint: { siteId, fingerprint } },
        });
        if (existing) return existing;
        for (const row of result.records) {
          try {
            row.energyUseId = (await this.prepare(tx, org, siteId, row.data)).energyUseId;
          } catch (error) {
            if (!(error instanceof DomainError)) throw error;
            result.issues.push({ row: row.row, field: 'occupancy', message: error.message });
          }
        }
        const batch = await tx.occupancyImportBatch.create({
          data: {
            organisationId: org,
            siteId,
            fingerprint,
            result: json(result),
            status: result.issues.length ? 'INVALID' : 'READY',
            createdBy: actor.userId,
          },
        });
        await this.audit(tx, actor, org, 'occupancy.import_previewed', batch.id, {
          siteId,
          sourceRows: result.sourceRows,
          errors: result.issues.length,
        });
        return batch;
      },
      { timeout: 30000 },
    );
  }
  async commit(actor: Actor, org: string, siteId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId);
        const batch = await tx.occupancyImportBatch.findFirst({
          where: { id: uuid.parse(id), organisationId: org, siteId },
        });
        if (!batch) throw new DomainError('NOT_FOUND', 'This import is unavailable.', 404);
        if (batch.status === 'COMMITTED') return batch;
        if (batch.status !== 'READY')
          throw new DomainError('INVALID_IMPORT', 'Fix workbook errors and upload again.', 409);
        const preview = batch.result as unknown as OccupancyPreview;
        for (const row of preview.records) {
          const prepared = await this.prepare(tx, org, siteId, row.data);
          if (prepared.energyUseId !== row.energyUseId)
            throw new DomainError('STALE_IMPORT', 'The end-use mapping changed. Preview again.', 409);
          await this.insert(tx, actor, org, siteId, row.data, batch.id);
        }
        await this.audit(tx, actor, org, 'occupancy.import_committed', batch.id, {
          siteId,
          count: preview.records.length,
        });
        return tx.occupancyImportBatch.update({
          where: { id },
          data: { status: 'COMMITTED', committedAt: new Date() },
        });
      },
      { timeout: 30000 },
    );
  }
}
