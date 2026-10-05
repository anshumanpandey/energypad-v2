import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FoundationService, type Actor } from './foundation';
import { readWorkbook } from './workbook';
import { classificationFields, classificationIssue, parseClassifications } from '../domain/driver-classifications';
import { WorkbookCellError, type WorkbookCellIssue } from '../domain/workbook-errors';
import { DomainError } from '../domain/policy';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class DriverClassificationService extends FoundationService {
  async update(actor: Actor, org: string, id: string, input: unknown) {
    const value = z.enum(['R', 'NR', 'N/A']);
    const data = z
      .object({
        heating: value,
        cooling: value,
        population: value,
        operatingHours: value,
        daylighting: value,
        buildingSize: value,
      })
      .strict()
      .parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      const prior = await tx.siteDriverClassification.findFirst({
        where: { id, organisationId: org },
        include: { site: true },
      });
      if (!prior || prior.site.archivedAt)
        throw new DomainError('NOT_FOUND', 'Active driver classification not found.', 404);
      const record = await tx.siteDriverClassification.update({
        where: { id },
        data: { ...data, authorId: actor.userId },
      });
      await this.audit(tx, actor, org, 'driver.classifications_updated', id, {
        before: Object.fromEntries(classificationFields.map((field) => [field, prior[field]])),
        after: data,
      });
      return record;
    });
  }
  async list(actor: Actor, org: string) {
    await this.membership(actor, org, 'organisation:update');
    return this.db.siteDriverClassification.findMany({
      where: { organisationId: org },
      include: { site: { select: { code: true, name: true } } },
      orderBy: [{ year: 'desc' }, { siteId: 'asc' }],
    });
  }
  async process(actor: Actor, org: string, bytes: Uint8Array, signature?: string) {
    await this.membership(actor, org, 'organisation:update');
    const window = Math.floor(Date.now() / 3600000),
      key = `driver-classifications:${org}:${window}`;
    const bucket = await this.db.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 40) throw new DomainError('RATE_LIMIT', 'Please wait before uploading more workbooks.', 429);
    const errors: WorkbookCellIssue[] = [];
    const sheets = await readWorkbook(bytes, { sheetName: 'Drivers', headerRow: 6, cellErrors: errors });
    const parsed = parseClassifications(sheets[0], errors);
    const fingerprint = hash(sheets);
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const sites = await tx.site.findMany({ where: { organisationId: org, archivedAt: null } });
        const saved = await tx.siteDriverClassification.findMany({ where: { organisationId: org } });
        const match = (text: string) =>
          sites.filter((s) => [s.code.toLowerCase(), s.name.toLowerCase()].includes(text.trim().toLowerCase()));
        const issue = (row: number, column: number, message: string) => {
          if (!errors.some((e) => e.row === row && e.column === column))
            errors.push(classificationIssue(row, column, message));
        };
        for (const row of sheets[0]?.rows ?? [])
          if (row.cells[0]?.trim() && match(row.cells[0]).length !== 1)
            issue(row.row, 1, 'Site must match exactly one active site code or name in this workspace.');
        const seen = new Map<string, number>();
        const prepared = parsed.records.flatMap((row) => {
          const matches = match(row.site);
          if (matches.length !== 1) return [];
          const site = matches[0],
            key = `${site.id}:${row.year}`;
          const priorRow = seen.get(key);
          if (priorRow !== undefined) {
            issue(priorRow, 1, `Duplicate site/year on row ${row.row}.`);
            issue(row.row, 1, `Duplicate site/year on row ${priorRow}.`);
          } else seen.set(key, row.row);
          const existing = saved.find((s) => s.siteId === site.id && s.year === row.year);
          for (const [i, field] of classificationFields.entries())
            if (existing && existing[field] !== row[field])
              issue(
                row.row,
                i + 3,
                `Conflicts with the saved ${field} classification (${existing[field]}) for this site and year.`,
              );
          return [{ ...row, site: site.code, siteName: site.name, siteId: site.id, existingId: existing?.id ?? null }];
        });
        if (errors.length) throw new WorkbookCellError(errors.sort((a, b) => a.row - b.row || a.column - b.column));
        const expected = hash({ org, fingerprint, prepared });
        const pending = prepared.filter((r) => !r.existingId);
        if (signature !== undefined && pending.length && signature !== expected)
          throw new DomainError(
            'PREVIEW_CHANGED',
            'The workbook or saved site data changed. Validate again before importing.',
            409,
          );
        if (signature !== undefined)
          for (const row of pending) {
            const record = await tx.siteDriverClassification.create({
              data: {
                organisationId: org,
                siteId: row.siteId,
                year: row.year,
                heating: row.heating,
                cooling: row.cooling,
                population: row.population,
                operatingHours: row.operatingHours,
                daylighting: row.daylighting,
                buildingSize: row.buildingSize,
                source: `Drivers worksheet ${fingerprint}`,
                sourceRow: row.row,
                authorId: actor.userId,
              },
            });
            await this.audit(tx, actor, org, 'driver.classifications_imported', record.id, {
              siteId: row.siteId,
              year: row.year,
              fingerprint,
              sourceRow: row.row,
            });
          }
        return {
          committed: signature !== undefined || !pending.length,
          signature: expected,
          count: prepared.length,
          newCount: pending.length,
          existingCount: prepared.length - pending.length,
          records: prepared,
        };
      },
      { timeout: 30000 },
    );
  }
}
