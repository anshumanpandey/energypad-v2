import { MonthlyPlanService } from './monthly-plans';
import { monthlyPlanInput, expandPlanMonths } from '../domain/monthly-plans';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { FoundationService, type Actor, type Mailer } from './foundation';
import { EmissionFactorService } from './emission-factors';
import { CarbonTargetService } from './carbon-targets';
import { DomainError, uuid } from '../domain/policy';
import { correctionReason } from '../domain/energy';
import { emissionFactorInput } from '../domain/emission-factors';
import { carbonTargetInput } from '../domain/carbon-targets';
import { carbonImportKind, type CarbonImportKind, type CarbonImportPreview } from '../domain/carbon-imports';
import { mapNamedWorkbook } from '../domain/workbook-template';
import { readWorkbook } from './workbook';
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
class PreviewRollback extends Error {}
export class CarbonImportService extends FoundationService {
  private monthly: MonthlyPlanService;
  constructor(
    db: PrismaClient,
    mail: Mailer,
    url: string,
    private factors: EmissionFactorService,
    private targets: CarbonTargetService,
  ) {
    super(db, mail, url);
    this.monthly = new MonthlyPlanService(db, mail, url);
  }
  private async access(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    kind: CarbonImportKind,
  ) {
    uuid.parse(siteId);
    await this.lock(tx, org);
    await this.membership(actor, org, kind === 'emissions' ? 'organisation:update' : 'analysis:write', tx);
    if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This active site is unavailable.', 404);
  }
  private async insert(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    kind: CarbonImportKind,
    row: CarbonImportPreview['records'][number],
  ) {
    if (kind === 'monthlyTargets' || kind === 'monitoring') {
      const { endUseEvidence, ...data } = row.data;
      const uses = await tx.siteEnergyUse.findMany({
        where: {
          organisationId: org,
          siteId,
          fuel: String(data.fuel),
          code: {
            in: String(data.energyUseCodes ?? '')
              .split(';')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
          },
        },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      if (JSON.stringify(uses) !== endUseEvidence)
        throw new DomainError('END_USE_CHANGED', 'End-use mapping changed. Preview again.', 409);
      return this.monthly.addWithin(tx, actor, org, siteId, data, row.supersedesId, row.reason);
    }
    if (kind === 'emissions') return this.factors.addWithin(tx, actor, org, row.data, row.supersedesId, row.reason);
    // Pin the preview's site/meter resolution; renames, archiving and reassignment invalidate commit.
    const { meterCode, ...data } = row.data;
    if (
      !(await tx.meter.findFirst({
        where: { id: String(data.meterId), code: String(meterCode), siteId, organisationId: org, archivedAt: null },
      }))
    )
      throw new DomainError('METER_CHANGED', 'The meter mapping changed. Preview again.', 409);
    return this.targets.addWithin(tx, actor, org, siteId, data, row.supersedesId, row.reason);
  }
  async upload(
    actor: Actor,
    org: string,
    siteId: string,
    kindInput: unknown,
    bytes: Uint8Array,
    sheetName?: string,
    template?: unknown,
  ) {
    const kind = carbonImportKind.parse(kindInput);
    await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, kind);
      const window = Math.floor(Date.now() / 3600000),
        key = `carbon-import:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    });
    const mapped = mapNamedWorkbook(await readWorkbook(bytes), kind, sheetName, template);
    const sheet = mapped.sheets[0];
    if (!sheet.rows.length || sheet.rows.length > 120)
      throw new DomainError('ROWS', 'Use between 1 and 120 non-empty rows.');
    const headers = sheet.headers.map((h) => h.trim());
    if (new Set(headers.map((h) => h.toLowerCase())).size !== headers.length)
      throw new DomainError('HEADERS', 'Use unique column headings.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ kind, sheet, selection: mapped.selection }))
      .digest('hex');
    const committed = await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, kind);
      return tx.carbonWorkbookBatch.findFirst({
        where: { organisationId: org, siteId, fingerprint, status: 'COMMITTED' },
      });
    });
    if (committed) return committed;
    const preview: CarbonImportPreview = { selection: mapped.selection, records: [], issues: [] };
    // Exercise the same constraints and intra-batch conflicts as commit, then roll back every destination/audit write.
    try {
      await this.db.$transaction(
        async (tx) => {
          await this.access(tx, actor, org, siteId, kind);
          for (const source of sheet.rows) {
            await tx.$executeRawUnsafe('SAVEPOINT carbon_preview_row');
            try {
              const raw = Object.fromEntries(headers.map((h, i) => [h, source.cells[i] ?? '']));
              const { supersedesId: prior, reason: why, ...fields } = raw;
              const supersedesId = prior ? uuid.parse(prior) : undefined;
              const reason = supersedesId ? correctionReason.parse(why) : undefined;
              if (!supersedesId && why)
                throw new DomainError('CORRECTION', 'A correction reason requires a superseded version ID.');
              let data: Record<string, string | number>;
              if (kind === 'emissions') data = emissionFactorInput.parse(fields);
              else if (kind === 'monthlyTargets' || kind === 'monitoring') {
                data = monthlyPlanInput.parse({
                  ...fields,
                  kind: kind === 'monthlyTargets' ? 'TARGET' : 'MONITORING',
                  requestKey: randomUUID(),
                });
                const uses = await tx.siteEnergyUse.findMany({
                  where: {
                    organisationId: org,
                    siteId,
                    fuel: String(data.fuel),
                    code: {
                      in: String(data.energyUseCodes ?? '')
                        .split(';')
                        .map((s) => s.trim().toUpperCase())
                        .filter(Boolean),
                    },
                  },
                  select: { id: true, code: true, name: true },
                  orderBy: { code: 'asc' },
                });
                data.endUseEvidence = JSON.stringify(uses);
                if (supersedesId && String(data.month).endsWith('-ALL'))
                  throw new DomainError('CORRECTION', 'Correct one saved month at a time.');
              } else {
                const { meterCode, unit, year, ...target } = fields;
                if (unit !== 'kgCO2e') throw new DomainError('UNIT', 'Target unit must be kgCO2e.');
                if (!/^\d{4}$/.test(year ?? '')) throw new DomainError('YEAR', 'Use a four-digit calendar year.');
                const meter = await tx.meter.findFirst({
                  where: { organisationId: org, siteId, code: meterCode, archivedAt: null },
                });
                if (!meter) throw new DomainError('METER', 'Use a registered active meter code from this site.');
                data = {
                  ...carbonTargetInput.parse({
                    ...target,
                    year: Number(year),
                    meterId: meter.id,
                    requestKey: randomUUID(),
                  }),
                  meterCode,
                };
              }
              const row = { row: source.row, data, ...(supersedesId ? { supersedesId, reason } : {}) };
              const rows =
                kind === 'monthlyTargets' || kind === 'monitoring'
                  ? expandPlanMonths(String(data.month)).map((month) => ({ ...row, data: { ...data, month } }))
                  : [row];
              for (const expanded of rows) await this.insert(tx, actor, org, siteId, kind, expanded);
              preview.records.push(...rows);
              await tx.$executeRawUnsafe('RELEASE SAVEPOINT carbon_preview_row');
            } catch (error) {
              await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT carbon_preview_row');
              await tx.$executeRawUnsafe('RELEASE SAVEPOINT carbon_preview_row');
              if (!(
                error instanceof DomainError ||
                error instanceof ZodError ||
                error instanceof Prisma.PrismaClientKnownRequestError
              ))
                throw error;
              preview.issues.push({
                row: source.row,
                message:
                  error instanceof DomainError
                    ? error.message
                    : error instanceof ZodError
                      ? error.issues[0].message
                      : 'This row conflicts with an existing record or another workbook row.',
              });
            }
          }
          throw new PreviewRollback();
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
    }
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, kind);
      const batch = await tx.carbonWorkbookBatch.create({
        data: {
          organisationId: org,
          siteId,
          kind,
          fingerprint,
          status: preview.issues.length ? 'INVALID' : 'READY',
          result: json(preview),
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'carbon.import_previewed', batch.id, { siteId, kind, status: batch.status });
      return batch;
    });
  }
  async commit(actor: Actor, org: string, siteId: string, id: string) {
    uuid.parse(id);
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        const batch = await tx.carbonWorkbookBatch.findFirst({ where: { id, organisationId: org, siteId } });
        if (!batch) throw new DomainError('NOT_FOUND', 'This import is unavailable.', 404);
        const kind = carbonImportKind.parse(batch.kind);
        await this.access(tx, actor, org, siteId, kind);
        if (batch.status === 'COMMITTED') return batch;
        const existing = await tx.carbonWorkbookBatch.findFirst({
          where: { organisationId: org, siteId, fingerprint: batch.fingerprint, status: 'COMMITTED' },
        });
        if (existing) return existing;
        if (batch.status !== 'READY')
          throw new DomainError('INVALID_IMPORT', 'Fix every preview error and upload again.', 409);
        const preview = batch.result as unknown as CarbonImportPreview;
        const receipt = [];
        for (const row of preview.records) {
          const record = await this.insert(tx, actor, org, siteId, kind, row);
          receipt.push({ row: row.row, id: record.id, revision: record.revision });
        }
        await this.audit(tx, actor, org, 'carbon.import_committed', batch.id, { siteId, kind, count: receipt.length });
        return tx.carbonWorkbookBatch.update({
          where: { id },
          data: { status: 'COMMITTED', committedAt: new Date(), receipt: json(receipt) },
        });
      },
      { timeout: 30000 },
    );
  }
}
