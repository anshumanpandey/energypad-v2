import { createHash } from 'node:crypto';
import { Prisma, type ConsumptionRecord } from '@prisma/client';
import { energyConversions, monthPeriod } from '../domain/energy';
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
type DefaultMeter = { id: string; site: string; code: string; name: string; fuel: string; unit: string };
type ImportResult = {
  committed: boolean;
  count: number;
  created: number;
  updated: number;
  unchanged: number;
  signature: string;
  defaultMeters: DefaultMeter[];
  records: {
    row: number;
    action: 'New' | 'Update' | 'Unchanged';
    meter: string;
    previousQuantity: string | null;
    site: string;
    month: string;
    quantity: string;
    unit: string;
    netCost: string | null;
    grossCost: string | null;
    currency: string | null | undefined;
  }[];
};
// Preview exercises the same transaction as commit, then deliberately rolls back
// provisional meters/conversions so an unconfirmed import leaves no domain data.
class PreviewComplete extends Error {
  constructor(public result: ImportResult) {
    super('Preview complete');
  }
}
const stableId = (value: unknown) => {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
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
    return this.db
      .$transaction(
        async (tx) => {
          await this.lock(tx, org);
          await this.membership(actor, org, 'organisation:update', tx);
          const existing = await tx.energyImportBatch.findMany({
            where: {
              organisationId: org,
              OR: [{ fingerprint }, { fingerprint: { startsWith: `${fingerprint}:` } }],
              status: 'COMMITTED',
            },
          });
          if (signature !== undefined && existing.length && !errors.length) {
            const batches = existing.filter((b) => (b.result as { signature?: string })?.signature === signature);
            const ids = batches.flatMap((b) => (b.result as { recordIds: string[] }).recordIds);
            if (
              ids.length &&
              (await tx.consumptionRecord.count({
                where: { organisationId: org, id: { in: ids }, replacement: { is: null } },
              })) === ids.length
            ) {
              return {
                committed: true,
                count: ids.length,
                signature,
                records: [],
                defaultMeters: [],
                created: batches.reduce((n, b) => n + Number((b.result as { created?: number }).created ?? 0), 0),
                updated: batches.reduce((n, b) => n + Number((b.result as { updated?: number }).updated ?? 0), 0),
                unchanged: batches.reduce((n, b) => n + Number((b.result as { unchanged?: number }).unchanged ?? 0), 0),
              };
            }
          }
          const sites = await tx.site.findMany({
            where: { organisationId: org, archivedAt: null },
            include: { meters: true },
          });
          const organisation = await tx.organisation.findUniqueOrThrow({ where: { id: org } });
          const prepared: {
            row: number;
            data: Prisma.ConsumptionRecordUncheckedCreateInput;
            previous: ConsumptionRecord | null;
            action: 'New' | 'Update' | 'Unchanged';
            meter: string;
          }[] = [];
          const seen = new Set<string>();
          const defaultMeters: DefaultMeter[] = [];
          for (const row of parsed.records) {
            const matches = sites.filter((s) => s.code.toLowerCase() === row.siteCode.toLowerCase());
            const site = matches.length === 1 ? matches[0] : undefined;
            if (!site) {
              errors.push(
                historicIssue(row.row, 1, 'Site Code must identify one existing active site in this organisation.'),
              );
              continue;
            }
            const meters = site.meters.filter((m) => !m.archivedAt && m.fuel === row.fuel && m.unit === row.unit);
            if (meters.length > 1) {
              errors.push(
                historicIssue(
                  row.row,
                  5,
                  'Multiple active meters match this site, utility and unit. Resolve ambiguous meters before importing.',
                ),
              );
              continue;
            }
            let meter = meters[0];
            if (!meter) {
              const base = `IMPORT-${row.fuel}-${row.unit}`;
              let code = base,
                suffix = 2;
              while (site.meters.some((m) => m.code === code)) code = `${base}-${suffix++}`;
              meter = await tx.meter.create({
                data: {
                  id: stableId([org, site.id, code]),
                  organisationId: org,
                  siteId: site.id,
                  code,
                  name: `Default ${row.fuel === 'SOLAR_PV' ? 'Solar PV' : row.fuel.toLowerCase()} (${row.unit})`,
                  fuel: row.fuel,
                  unit: row.unit,
                },
              });
              site.meters.push(meter);
              defaultMeters.push({
                id: meter.id,
                site: site.code,
                code,
                name: meter.name,
                fuel: meter.fuel,
                unit: meter.unit,
              });
              await this.audit(tx, actor, org, 'meter.created', meter.id, {
                siteId: site.id,
                source: 'historic-consumption-import',
              });
            }
            const key = `${meter.id}:${row.month}`;
            if (seen.has(key)) {
              errors.push(historicIssue(row.row, 3, 'Duplicate meter and month within this workbook.'));
              continue;
            }
            seen.add(key);
            try {
              if (
                defaultMeters.some((m) => m.id === meter.id) &&
                !energyConversions[row.unit as keyof typeof energyConversions]
              ) {
                const period = monthPeriod(row.month);
                const conversion = await tx.unitConversionVersion.create({
                  data: {
                    id: stableId([meter.id, row.month, row.factor]),
                    organisationId: org,
                    siteId: site.id,
                    meterId: meter.id,
                    sourceUnit: row.unit,
                    fuel: row.fuel,
                    factor: row.factor,
                    validFrom: period.start,
                    validUntil: period.end,
                    source: `Historic Consumption workbook ${fingerprint}, row ${row.row}`,
                    authorId: actor.userId,
                  },
                });
                await this.audit(tx, actor, org, 'energy.conversion_added', conversion.id, {
                  siteId: site.id,
                  meterId: meter.id,
                });
              }
              const gross = row.grossCost === null ? null : new Prisma.Decimal(row.grossCost);
              const vat = row.vatCost === null ? null : new Prisma.Decimal(row.vatCost);
              const net = gross !== null && vat !== null ? gross.minus(vat) : null;
              const period = monthPeriod(row.month);
              const overlaps = await tx.consumptionRecord.findMany({
                where: {
                  organisationId: org,
                  siteId: site.id,
                  meterId: meter.id,
                  periodStart: { lt: period.end },
                  periodEnd: { gt: period.start },
                  replacement: { is: null },
                },
              });
              const previous = overlaps[0] ?? null;
              if (
                overlaps.length > 1 ||
                (previous &&
                  (+previous.periodStart !== +period.start ||
                    +previous.periodEnd !== +period.end ||
                    previous.fuel !== row.fuel ||
                    previous.sourceUnit !== row.unit))
              )
                throw new DomainError(
                  'PERIOD_CONFLICT',
                  'Existing readings do not match this full month, utility and unit.',
                );
              const data = await this.prepareReading(
                tx,
                actor,
                org,
                site.id,
                {
                  meterId: meter.id,
                  month: row.month,
                  quantity: row.quantity,
                  endUse: row.endUse,
                  externalLegacyId: previous?.externalLegacyId ?? '',
                },
                previous ? { previous, useLatestConversion: true } : undefined,
              );
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
              const nextData: Prisma.ConsumptionRecordUncheckedCreateInput = {
                ...data,
                netCost: net,
                vatCost: vat,
                grossCost: gross,
                vatPercent: null,
                currency: gross === null ? null : (site.currency ?? organisation.currency),
                importProvenance: json({
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
              };
              if (!previous) nextData.sourceProvenance = nextData.importProvenance;
              const provenance = (previous?.importProvenance ?? previous?.sourceProvenance) as {
                population?: string | null;
                operatingHours?: string | null;
              } | null;
              const same =
                previous &&
                [
                  'sourceQuantity',
                  'sourceUnit',
                  'fuel',
                  'normalizedKwh',
                  'conversionFactor',
                  'conversionVersion',
                  'netCost',
                  'vatCost',
                  'grossCost',
                  'vatPercent',
                  'currency',
                  'endUse',
                  'estimated',
                ].every(
                  (key) =>
                    String(previous[key as keyof ConsumptionRecord] ?? '') ===
                    String(nextData[key as keyof typeof nextData] ?? ''),
                ) &&
                (provenance?.population ?? null) === row.population &&
                (provenance?.operatingHours ?? null) === row.dailyHours;
              prepared.push({
                row: row.row,
                data: nextData,
                previous,
                meter: meter.code,
                action: !previous ? 'New' : same ? 'Unchanged' : 'Update',
              });
            } catch (error) {
              if (!(error instanceof DomainError)) throw error;
              errors.push(historicIssue(row.row, error.code === 'CONVERSION_REQUIRED' ? column(11) : 3, error.message));
            }
          }
          if (errors.length) throw new WorkbookCellError(errors.sort((a, b) => a.row - b.row || a.column - b.column));
          const current = hash({
            defaultMeters,
            records: prepared.map((r) => ({
              ...r,
              previous: r.previous?.id ?? null,
              data: { ...r.data, authorId: undefined },
            })),
          });
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
                  fingerprint: `${fingerprint}:${current}`,
                  sheets: json(sheets),
                  createdBy: actor.userId,
                  status: 'COMMITTED',
                  committedAt: new Date(),
                },
              });
              const ids = [];
              for (const row of rows) {
                if (row.action === 'Unchanged') {
                  ids.push(row.previous!.id);
                  continue;
                }
                const reason = `Updated from Historic Consumption workbook, row ${row.row}`;
                const record = await tx.consumptionRecord.create({
                  data: {
                    ...row.data,
                    energyImportId: batch.id,
                    ...(row.previous
                      ? { supersedesId: row.previous.id, revision: row.previous.revision + 1, correctionReason: reason }
                      : {}),
                  },
                });
                ids.push(record.id);
                await this.audit(tx, actor, org, row.previous ? 'energy.corrected' : 'energy.recorded', record.id, {
                  siteId: record.siteId,
                  meterId,
                  ...(row.previous
                    ? { supersedesId: row.previous.id, revision: record.revision, reason, useLatestConversion: true }
                    : {}),
                });
              }
              await tx.energyImportBatch.update({
                where: { id: batch.id },
                data: {
                  result: {
                    count: ids.length,
                    recordIds: ids,
                    signature: current,
                    created: rows.filter((r) => r.action === 'New').length,
                    updated: rows.filter((r) => r.action === 'Update').length,
                    unchanged: rows.filter((r) => r.action === 'Unchanged').length,
                  },
                },
              });
              await this.audit(tx, actor, org, 'energy.import_committed', batch.id, {
                count: ids.length,
                siteId: rows[0].data.siteId,
              });
            }
          }
          const result: ImportResult = {
            defaultMeters,
            committed: signature !== undefined || prepared.every((r) => r.action === 'Unchanged'),
            count: prepared.length,
            created: prepared.filter((r) => r.action === 'New').length,
            updated: prepared.filter((r) => r.action === 'Update').length,
            unchanged: prepared.filter((r) => r.action === 'Unchanged').length,
            signature: current,
            records: prepared.map((r) => ({
              row: r.row,
              action: r.action,
              meter: r.meter,
              previousQuantity: r.previous?.sourceQuantity.toString() ?? null,
              site: sites.find((s) => s.id === r.data.siteId)!.code,
              month: (r.data.periodStart as Date).toISOString().slice(0, 7),
              quantity: String(r.data.sourceQuantity),
              unit: r.data.sourceUnit,
              netCost: r.data.netCost?.toString() ?? null,
              grossCost: r.data.grossCost?.toString() ?? null,
              currency: r.data.currency,
            })),
          };
          if (signature === undefined) throw new PreviewComplete(result);
          return result;
        },
        { timeout: 30000 },
      )
      .catch((error) => {
        if (error instanceof PreviewComplete) return error.result;
        throw error;
      });
  }
}
