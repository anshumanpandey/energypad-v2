import { matchingWorkbookSites } from '../domain/workbook-sites';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { MonthlyPlanService } from './monthly-plans';
import type { Actor } from './foundation';
import { readWorkbook } from './workbook';
import { parseTargets, targetIssue } from '../domain/target-import';
import type { MonthlyPlanPayload } from '../domain/monthly-plans';
import { WorkbookCellError, type WorkbookCellIssue } from '../domain/workbook-errors';
import { DomainError } from '../domain/policy';
import { missingImportMonths } from '../domain/import-missing-months';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requestId = (value: unknown) => {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export class TargetImportService extends MonthlyPlanService {
  async process(actor: Actor, org: string, bytes: Uint8Array, signature?: string, fillMissing = false) {
    await this.membership(actor, org, 'organisation:update');
    const window = Math.floor(Date.now() / 3600000),
      key = `target-import:${org}:${window}`;
    const bucket = await this.db.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 40) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    const errors: WorkbookCellIssue[] = [];
    const sheets = await readWorkbook(bytes, { sheetName: 'Targets', cellErrors: errors });
    const parsed = parseTargets(sheets[0], errors),
      fingerprint = hash({ sheets, fillMissing });
    const gaps = missingImportMonths(
      parsed.records,
      (r) => ({ site: r.site, scope: `${r.fuel} · ${r.unit}` }),
      (r, month) => ({
        ...r,
        month,
        energy: '0',
        carbon: '0',
        ...(r.cost !== undefined ? { cost: '0' } : {}),
        ...(r.grossCost !== undefined ? { grossCost: '0' } : {}),
        zeroFilled: true,
      }),
      fillMissing,
    );
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const sites = await tx.site.findMany({ where: { organisationId: org, archivedAt: null } });
        const saved = await tx.monthlyPlanVersion.findMany({
          where: { organisationId: org, kind: 'TARGET', replacement: { is: null } },
        });
        const match = (code: string) => matchingWorkbookSites(sites, code);
        for (const row of sheets[0]?.rows ?? []) {
          if (
            row.cells[0]?.trim() &&
            match(row.cells[0]).length !== 1 &&
            !errors.some((e) => e.row === row.row && e.column === 1)
          )
            errors.push(targetIssue(row.row, 1, 'Site name must match one active site in this workspace.'));
        }
        const prepared = gaps.records.flatMap((row) => {
          const matches = match(row.site);
          if (matches.length !== 1) return [];
          const site = matches[0];
          const previous = saved.find(
            (s) => s.siteId === site.id && s.month === row.month && s.fuel === row.fuel && s.unit === row.unit,
          );
          const old = previous?.payload as MonthlyPlanPayload | undefined;
          if (row.zeroFilled && previous) return []; // Retain existing targets.
          const same =
            old &&
            new Prisma.Decimal(old.energy).equals(row.energy) &&
            old.carbon !== '' &&
            new Prisma.Decimal(old.carbon).equals(row.carbon) &&
            new Prisma.Decimal(old.conversionFactor).equals(row.unit === 'MWh' ? 1000 : 1) &&
            (row.grossCost === undefined ||
              (old.grossCost !== undefined &&
                old.grossCost !== '' &&
                new Prisma.Decimal(old.grossCost).equals(row.grossCost) &&
                old.currency === row.currency)) &&
            (row.cost === undefined ||
              (old.cost !== undefined &&
                old.cost !== '' &&
                new Prisma.Decimal(old.cost).equals(row.cost) &&
                old.currency === row.currency));
          return [
            {
              ...row,
              site: site.name,
              siteId: site.id,
              previousId: previous?.id ?? null,
              cost: row.cost ?? old?.cost,
              grossCost: row.grossCost ?? old?.grossCost,
              currency: row.cost === undefined && row.grossCost === undefined ? old?.currency : row.currency,
              action: !previous ? 'New' : same ? 'Unchanged' : 'Update',
            },
          ];
        });
        if (errors.length) throw new WorkbookCellError(errors.sort((a, b) => a.row - b.row || a.column - b.column));
        const expected = hash({ org, fingerprint, prepared }),
          pending = prepared.filter((r) => r.action !== 'Unchanged');
        if (signature !== undefined && pending.length && signature !== expected)
          throw new DomainError(
            'PREVIEW_CHANGED',
            'The workbook or saved targets changed. Validate again before importing.',
            409,
          );
        if (signature !== undefined)
          for (const row of pending) {
            await this.addWithin(
              tx,
              actor,
              org,
              row.siteId,
              {
                kind: 'TARGET',
                month: row.month,
                fuel: row.fuel,
                unit: row.unit,
                energy: row.energy,
                carbon: row.carbon,
                cost: row.cost,
                grossCost: row.grossCost,
                currency: row.currency,
                conversionFactor: row.unit === 'MWh' ? '1000' : '1',
                source: row.zeroFilled
                  ? `Missing Targets month ${row.month}; user confirmed zero fill; SHA256 ${fingerprint}`
                  : `Targets worksheet, row ${row.row}, SHA256 ${fingerprint}`,
                requestKey: requestId({ org, expected, row: row.row }),
              },
              row.previousId ?? undefined,
              row.previousId ? `Updated from Targets worksheet, row ${row.row}` : undefined,
            );
          }
        return {
          missingMonths: gaps.missingMonths,
          zeroFillConfirmed: fillMissing,
          committed: signature !== undefined || !pending.length,
          signature: expected,
          count: prepared.length,
          created: prepared.filter((r) => r.action === 'New').length,
          updated: prepared.filter((r) => r.action === 'Update').length,
          unchanged: prepared.length - pending.length,
          records: prepared,
        };
      },
      { timeout: 30000 },
    );
  }
}
