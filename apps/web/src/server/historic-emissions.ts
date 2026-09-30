import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { EmissionFactorService } from './emission-factors';
import type { Actor } from './foundation';
import { readWorkbook } from './workbook';
import { emissionsSheet, emissionCellIssue, parseEmissions } from '../domain/historic-emissions';
import { WorkbookCellError, type WorkbookCellIssue } from '../domain/workbook-errors';
import { emissionFactorInput } from '../domain/emission-factors';
import { monthPeriod } from '../domain/energy';
import { DomainError } from '../domain/policy';

const settingsSchema = z
  .object({
    geography: emissionFactorInput.shape.geography,
    basis: emissionFactorInput.shape.basis,
  })
  .strict();
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class HistoricEmissionsService extends EmissionFactorService {
  async process(actor: Actor, org: string, bytes: Uint8Array, settingsInput: unknown, signature?: string) {
    await this.membership(actor, org, 'organisation:update');
    const settings = settingsSchema.parse(settingsInput);
    const window = Math.floor(Date.now() / 3600000);
    const key = `emissions-upload:${org}:${window}`;
    const bucket = await this.db.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 40) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    const errors: WorkbookCellIssue[] = [];
    const sheets = await readWorkbook(bytes, { sheetName: emissionsSheet, cellErrors: errors });
    const parsed = parseEmissions(sheets[0], errors);
    const fingerprint = hash({ sheets, settings });
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const sites = await tx.site.findMany({ where: { organisationId: org, archivedAt: null } });
        const factors = await tx.emissionFactorVersion.findMany({
          where: {
            organisationId: org,
            ...settings,
            replacement: { is: null },
          },
        });
        const prepared: {
          row: number;
          siteId: string;
          site: string;
          month: string;
          existingId: string | null;
          data: z.infer<typeof emissionFactorInput>;
        }[] = [];
        // Resolve site errors even on rows with other malformed cells.
        for (const row of sheets[0]?.rows ?? []) {
          const code = row.cells[0]?.trim();
          if (
            code &&
            !errors.some((e) => e.row === row.row && e.column === 1) &&
            sites.filter((site) => site.code.toLowerCase() === code.toLowerCase()).length !== 1
          )
            errors.push(
              emissionCellIssue(row.row, 1, 'Site Code must identify one existing active site in this organisation.'),
            );
        }
        for (const row of parsed.records) {
          const matches = sites.filter((site) => site.code.toLowerCase() === row.siteCode.toLowerCase());
          if (matches.length !== 1) continue;
          const site = matches[0];
          const period = monthPeriod(row.month);
          const overlaps = factors.filter(
            (f) =>
              (!f.siteId || f.siteId === site.id) &&
              f.fuel === row.fuel &&
              +f.validFrom < +period.end &&
              +f.validUntil > +period.start,
          );
          const existing =
            overlaps.length === 1 &&
            overlaps[0].siteId === site.id &&
            +overlaps[0].validFrom === +period.start &&
            +overlaps[0].validUntil === +period.end &&
            overlaps[0].factor.equals(new Prisma.Decimal(row.factor))
              ? overlaps[0]
              : null;
          if (overlaps.length && !existing) {
            errors.push(
              emissionCellIssue(
                row.row,
                6,
                'A different current factor already covers this site, utility, month, geography and basis. Correct the existing factor before importing.',
              ),
            );
            continue;
          }
          prepared.push({
            row: row.row,
            siteId: site.id,
            site: site.code,
            month: row.month,
            existingId: existing?.id ?? null,
            data: {
              ...settings,
              fuel: row.fuel as z.infer<typeof emissionFactorInput>['fuel'],
              unit: 'kgCO2e/kWh',
              factor: row.factor,
              firstDay: period.start.toISOString().slice(0, 10),
              lastDay: new Date(+period.end - 86400000).toISOString().slice(0, 10),
              source: `Emissions worksheet, site ${site.code}, row ${row.row}, workbook ${fingerprint}`,
            },
          });
        }
        if (errors.length) throw new WorkbookCellError(errors.sort((a, b) => a.row - b.row || a.column - b.column));
        const expected = hash({ org, fingerprint, prepared });
        const pending = prepared.filter((r) => !r.existingId);
        if (signature !== undefined && pending.length && signature !== expected)
          throw new DomainError(
            'PREVIEW_CHANGED',
            'The workbook, settings or existing factors changed. Validate again before importing.',
            409,
          );
        if (signature !== undefined) {
          for (const row of pending) await this.addWithin(tx, actor, org, row.data, undefined, undefined, row.siteId);
          if (pending.length)
            await this.audit(tx, actor, org, 'carbon.emissions_imported', org, {
              fingerprint,
              count: pending.length,
              ...settings,
            });
        }
        return {
          committed: signature !== undefined || !pending.length,
          count: prepared.length,
          newCount: pending.length,
          existingCount: prepared.length - pending.length,
          signature: expected,
          ...settings,
          records: prepared.map((r) => ({
            row: r.row,
            site: r.site,
            month: r.month,
            fuel: r.data.fuel,
            factor: r.data.factor,
            unit: r.data.unit,
            existing: !!r.existingId,
          })),
        };
      },
      { timeout: 30000 },
    );
  }
}
