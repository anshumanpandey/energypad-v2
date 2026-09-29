import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { EnergyService } from './energy';
import type { Actor } from './foundation';
import { DomainError } from '../domain/policy';
import { WorkbookCellError, type WorkbookCellIssue } from '../domain/workbook-errors';
import {
  historicSheet,
  historicIssue,
  parseHistoric,
  historicIgnoredColumns,
  historicSourceColumn,
} from '../domain/historic-consumption';
import { readWorkbook } from './workbook';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
export class HistoricConsumptionService extends EnergyService {
  async process(actor: Actor, org: string, bytes: Uint8Array, signature?: string) {
    await this.membership(actor, org, 'organisation:update');
    const window = Math.floor(Date.now() / 3600000);
    const bucket = await this.db.rateLimitBucket.upsert({
      where: { key: `historic-upload:${org}:${window}` },
      create: { key: `historic-upload:${org}:${window}`, count: 1, expiresAt: new Date((window + 1) * 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 40) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    const errors: WorkbookCellIssue[] = [];
    const sheets = await readWorkbook(bytes, {
      sheetName: historicSheet,
      cellErrors: errors,
      ignoredColumns: historicIgnoredColumns,
    });
    const parsed = parseHistoric(sheets[0], errors);
    const column = (value: number) => historicSourceColumn(sheets[0]?.headers ?? [], value);
    const fingerprint = `historic-v1:${hash(sheets)}`;
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const existing = await tx.energyImportBatch.findMany({
          where: { organisationId: org, fingerprint, status: 'COMMITTED' },
        });
        if (existing.length && !errors.length)
          return {
            committed: true,
            count: existing.reduce((n, b) => n + Number((b.result as { count?: number })?.count ?? 0), 0),
            signature: '',
            records: [],
          };
        const sites = await tx.site.findMany({
          where: { organisationId: org, archivedAt: null },
          include: { meters: { where: { archivedAt: null } } },
        });
        const organisation = await tx.organisation.findUniqueOrThrow({ where: { id: org } });
        const prepared: { row: number; data: Prisma.ConsumptionRecordUncheckedCreateInput }[] = [];
        const seen = new Set<string>();
        for (const row of parsed.records) {
          const matches = sites.filter((s) => s.code.toLowerCase() === row.siteCode.toLowerCase());
          const site = matches.length === 1 ? matches[0] : undefined;
          if (!site) {
            errors.push(
              historicIssue(row.row, 1, 'Site Code must identify one existing active site in this organisation.'),
            );
            continue;
          }
          const meters = site.meters.filter((m) => m.fuel === row.fuel && m.unit === row.unit);
          if (meters.length !== 1) {
            errors.push(
              historicIssue(
                row.row,
                5,
                'Exactly one active meter must match this site, utility and unit. Resolve missing or ambiguous meters before importing.',
              ),
            );
            continue;
          }
          const meter = meters[0],
            key = `${meter.id}:${row.month}`;
          if (seen.has(key)) {
            errors.push(historicIssue(row.row, 3, 'Duplicate meter and month within this workbook.'));
            continue;
          }
          seen.add(key);
          try {
            const gross = row.grossCost === null ? null : new Prisma.Decimal(row.grossCost);
            const vat = row.vatCost === null ? null : new Prisma.Decimal(row.vatCost);
            const net = gross !== null && vat !== null ? gross.minus(vat) : null;
            const data = await this.prepareReading(tx, actor, org, site.id, {
              meterId: meter.id,
              month: row.month,
              quantity: row.quantity,
              endUse: row.endUse,
            });
            if (!new Prisma.Decimal(data.conversionFactor as string).equals(row.factor)) {
              errors.push(
                historicIssue(
                  row.row,
                  column(11),
                  `Expected ${data.conversionFactor} kWh per ${row.unit}, matching the meter conversion for this month.`,
                ),
              );
              continue;
            }
            prepared.push({
              row: row.row,
              data: {
                ...data,
                netCost: net,
                vatCost: vat,
                grossCost: gross,
                vatPercent: null,
                currency: gross === null ? null : (site.currency ?? organisation.currency),
                sourceProvenance: json({
                  format: 'historic-consumption-v1',
                  sheet: historicSheet,
                  row: row.row,
                  costBasis: 'GROSS',
                  population: row.population,
                  operatingHours: row.dailyHours,
                  operatingHoursBasis: 'HOURS_PER_DAY',
                  utilityType: row.utility,
                  conversionFactor: row.factor,
                }),
              },
            });
          } catch (error) {
            if (!(error instanceof DomainError)) throw error;
            errors.push(historicIssue(row.row, error.code === 'CONVERSION_REQUIRED' ? column(11) : 3, error.message));
          }
        }
        if (errors.length) throw new WorkbookCellError(errors.sort((a, b) => a.row - b.row || a.column - b.column));
        const current = hash(prepared.map((r) => ({ ...r, data: { ...r.data, authorId: undefined } })));
        if (signature !== undefined) {
          if (signature !== current)
            throw new DomainError(
              'STALE_PREVIEW',
              'The workbook or meter context changed. Validate again before importing.',
              409,
            );
          for (const meterId of new Set(prepared.map((r) => r.data.meterId))) {
            const rows = prepared.filter((r) => r.data.meterId === meterId);
            const batch = await tx.energyImportBatch.create({
              data: {
                organisationId: org,
                siteId: rows[0].data.siteId,
                meterId,
                fingerprint,
                sheets: json(sheets),
                createdBy: actor.userId,
                status: 'COMMITTED',
                committedAt: new Date(),
              },
            });
            const ids = [];
            for (const row of rows) {
              const record = await tx.consumptionRecord.create({ data: { ...row.data, energyImportId: batch.id } });
              ids.push(record.id);
              await this.audit(tx, actor, org, 'energy.recorded', record.id, { siteId: record.siteId, meterId });
            }
            await tx.energyImportBatch.update({
              where: { id: batch.id },
              data: { result: { count: ids.length, recordIds: ids } },
            });
            await this.audit(tx, actor, org, 'energy.import_committed', batch.id, {
              count: ids.length,
              siteId: rows[0].data.siteId,
            });
          }
        }
        return {
          committed: signature !== undefined,
          count: prepared.length,
          signature: current,
          records: prepared.map((r) => ({
            row: r.row,
            site: sites.find((s) => s.id === r.data.siteId)!.code,
            month: (r.data.periodStart as Date).toISOString().slice(0, 7),
            quantity: String(r.data.sourceQuantity),
            unit: r.data.sourceUnit,
            netCost: r.data.netCost?.toString() ?? null,
            grossCost: r.data.grossCost?.toString() ?? null,
            currency: r.data.currency,
          })),
        };
      },
      { timeout: 30000 },
    );
  }
}
