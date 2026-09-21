import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import {
  observationInput,
  observationCorrectionInput,
  scheduleCorrectionInput,
  scheduleInput,
  mapDriverWorkbook,
  driverLabels,
  type DriverPreview,
  type ObservationInput,
} from '../domain/drivers';
import { monthPeriod, missingMonths } from '../domain/energy';
import { readWorkbook } from './workbook';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export class DriverService extends FoundationService {
  private async writeAccess(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string) {
    uuid.parse(siteId);
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
    if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This active site is not available.', 404);
  }
  async list(actor: Actor, org: string, siteId: string, year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new DomainError('YEAR', 'Choose a valid year.');
    await this.getSite(actor, org, siteId);
    const start = new Date(`${year}-01-01`),
      end = new Date(`${year + 1}-01-01`);
    const observations = await this.db.driverObservation.findMany({
      where: { organisationId: org, siteId, replacement: { is: null }, month: { gte: start, lt: end } },
      orderBy: [{ month: 'asc' }, { driver: 'asc' }],
    });
    const schedules = await this.db.operatingSchedule.findMany({
      where: {
        organisationId: org,
        siteId,
        replacement: { is: null },
        validFrom: { lt: end },
        validUntil: { gt: start },
      },
      orderBy: { validFrom: 'asc' },
    });
    return {
      observations,
      schedules,
      coverage: Object.keys(driverLabels).map((driver) => ({
        driver,
        missing: missingMonths(
          year,
          observations.filter((o) => o.driver === driver).map((o) => o.month.toISOString().slice(0, 7)),
        ),
      })),
    };
  }
  private async conflict(tx: Prisma.TransactionClient, siteId: string, data: ObservationInput) {
    return tx.driverObservation.findFirst({
      where: { siteId, month: monthPeriod(data.month).start, driver: data.driver },
    });
  }
  private async insert(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    batchId?: string,
  ) {
    const data = observationInput.parse(input);
    if (await this.conflict(tx, siteId, data))
      throw new DomainError(
        'DRIVER_CONFLICT',
        'An observation already exists for this driver and month. Existing observations are never overwritten.',
        409,
      );
    const record = await tx.driverObservation.create({
      data: {
        ...data,
        month: monthPeriod(data.month).start,
        organisationId: org,
        siteId,
        authorId: actor.userId,
        importBatchId: batchId,
      },
    });
    await this.audit(tx, actor, org, 'driver.recorded', record.id, {
      siteId,
      month: data.month,
      driver: data.driver,
      ...(batchId ? { batchId } : {}),
    });
    return record;
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown) {
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org, siteId);
      return this.insert(tx, actor, org, siteId, input);
    });
  }
  async addSchedule(actor: Actor, org: string, siteId: string, input: unknown, supersedesId?: string, reason?: string) {
    const data = scheduleInput.parse(input);
    const validFrom = new Date(data.firstDay),
      validUntil = new Date(new Date(data.lastDay).getTime() + 86400000);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org, siteId);
      const previous = supersedesId
        ? await tx.operatingSchedule.findFirst({
            where: { id: uuid.parse(supersedesId), organisationId: org, siteId, replacement: { is: null } },
          })
        : null;
      if (supersedesId && !previous)
        throw new DomainError(
          'STALE_REVISION',
          'This schedule has changed or is unavailable. Reload before correcting it.',
          409,
        );
      if (
        await tx.operatingSchedule.findFirst({
          where: {
            siteId,
            replacement: { is: null },
            ...(previous ? { id: { not: previous.id } } : {}),
            validFrom: { lt: validUntil },
            validUntil: { gt: validFrom },
          },
        })
      )
        throw new DomainError(
          'SCHEDULE_OVERLAP',
          'A site schedule already covers part of these dates. Choose a non-overlapping range.',
          409,
        );
      const record = await tx.operatingSchedule.create({
        data: {
          organisationId: org,
          siteId,
          ...(previous ? { supersedesId: previous.id, revision: previous.revision + 1, correctionReason: reason } : {}),
          name: data.name,
          validFrom,
          validUntil,
          weeklyHours: data.weeklyHours,
          source: data.source,
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, previous ? 'driver.schedule_corrected' : 'driver.schedule_added', record.id, {
        siteId,
        ...(previous ? { supersedesId: previous.id, reason, revision: record.revision } : {}),
      });
      return record;
    });
  }
  async correctObservation(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    uuid.parse(id);
    const { observation: data, reason } = observationCorrectionInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org, siteId);
      const previous = await tx.driverObservation.findFirst({
        where: { id, organisationId: org, siteId, replacement: { is: null } },
      });
      if (!previous)
        throw new DomainError(
          'STALE_REVISION',
          'This observation has changed or is unavailable. Reload before correcting it.',
          409,
        );
      if (previous.month.toISOString().slice(0, 7) !== data.month || previous.driver !== data.driver)
        throw new DomainError('IDENTITY', 'The observation month and driver cannot be changed.');
      const record = await tx.driverObservation.create({
        data: {
          ...data,
          month: previous.month,
          organisationId: org,
          siteId,
          authorId: actor.userId,
          importBatchId: previous.importBatchId,
          supersedesId: previous.id,
          revision: previous.revision + 1,
          correctionReason: reason,
        },
      });
      await this.audit(tx, actor, org, 'driver.corrected', record.id, {
        siteId,
        supersedesId: id,
        reason,
        revision: record.revision,
      });
      return record;
    });
  }
  async correctSchedule(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const { schedule, reason } = scheduleCorrectionInput.parse(input);
    return this.addSchedule(actor, org, siteId, schedule, id, reason);
  }
  async history(actor: Actor, org: string, siteId: string, id: string, kind: 'observations' | 'schedules') {
    uuid.parse(id);
    await this.getSite(actor, org, siteId);
    const where = { organisationId: org, siteId };
    const rows =
      kind === 'observations'
        ? await this.db.driverObservation.findMany({ where, orderBy: { revision: 'desc' } })
        : await this.db.operatingSchedule.findMany({ where, orderBy: { revision: 'desc' } });
    const selected = rows.find((r) => r.id === id);
    if (!selected) throw new DomainError('NOT_FOUND', 'This revision is not available.', 404);
    let root = selected;
    while (root.supersedesId) root = rows.find((r) => r.id === root.supersedesId)!;
    const chain = [root];
    let next = rows.find((r) => r.supersedesId === root.id);
    while (next) {
      chain.push(next);
      next = rows.find((r) => r.supersedesId === next!.id);
    }
    return chain.reverse();
  }
  async imports(actor: Actor, org: string, siteId: string) {
    await this.membership(actor, org, 'organisation:update');
    await this.getSite(actor, org, siteId);
    return this.db.driverImportBatch.findMany({
      where: { organisationId: org, siteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
  async upload(actor: Actor, org: string, siteId: string, bytes: Uint8Array) {
    await this.db.$transaction(async (tx) => {
      await this.writeAccess(tx, actor, org, siteId);
      const window = Math.floor(Date.now() / 3600000);
      const key = `driver-upload:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    });
    const sheets = await readWorkbook(bytes);
    const fingerprint = createHash('sha256').update(JSON.stringify(sheets)).digest('hex');
    const result = mapDriverWorkbook(sheets);
    return this.db.$transaction(
      async (tx) => {
        await this.writeAccess(tx, actor, org, siteId);
        const existing = await tx.driverImportBatch.findUnique({
          where: { siteId_fingerprint: { siteId, fingerprint } },
        });
        if (existing) return existing;
        for (const row of result.records)
          if (await this.conflict(tx, siteId, row.data))
            result.issues.push({
              row: row.row,
              field: 'month',
              message: 'An observation already exists for this driver/month.',
            });
        const batch = await tx.driverImportBatch.create({
          data: {
            organisationId: org,
            siteId,
            fingerprint,
            result: json(result),
            status: result.issues.length ? 'INVALID' : 'READY',
            createdBy: actor.userId,
          },
        });
        await this.audit(tx, actor, org, 'driver.import_previewed', batch.id, {
          siteId,
          rows: result.records.length,
          errors: result.issues.length,
        });
        return batch;
      },
      { timeout: 30000 },
    );
  }
  async commit(actor: Actor, org: string, siteId: string, batchId: string) {
    uuid.parse(batchId);
    return this.db.$transaction(
      async (tx) => {
        await this.writeAccess(tx, actor, org, siteId);
        const batch = await tx.driverImportBatch.findFirst({ where: { id: batchId, organisationId: org, siteId } });
        if (!batch) throw new DomainError('NOT_FOUND', 'This import is not available.', 404);
        if (batch.status === 'COMMITTED') return batch;
        if (batch.status !== 'READY')
          throw new DomainError('INVALID_IMPORT', 'Fix the workbook errors and upload again.', 409);
        const result = batch.result as unknown as DriverPreview;
        for (const row of result.records) await this.insert(tx, actor, org, siteId, row.data, batch.id);
        await this.audit(tx, actor, org, 'driver.import_committed', batch.id, { siteId, count: result.records.length });
        return tx.driverImportBatch.update({
          where: { id: batch.id },
          data: { status: 'COMMITTED', committedAt: new Date() },
        });
      },
      { timeout: 30000 },
    );
  }
}
