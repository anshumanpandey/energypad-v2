import { z } from 'zod';
import { correctionReason } from './energy';
import { DomainError } from './policy';
import type { ImportSheet, RowIssue } from './sites';
const date = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, 'Use a valid YYYY-MM-DD date.');
const count = z
  .string()
  .trim()
  .regex(/^\d{1,9}$/, 'Use a non-negative whole count.')
  .transform(Number)
  .nullable();
export const occupancyInput = z
  .object({
    firstDay: date,
    lastDay: date,
    energyUseCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,39}$/),
    regularCount: count,
    irregularCount: count,
    source: z.string().trim().min(3).max(500),
    legacySource: z.string().trim().max(100).default(''),
    legacyId: z.string().trim().max(160).default(''),
  })
  .strict()
  .refine((v) => v.lastDay >= v.firstDay, 'Last day must follow first day.')
  .refine((v) => v.regularCount !== null || v.irregularCount !== null, 'Record at least one count.')
  .refine((v) => !v.legacyId || !!v.legacySource, 'A legacy ID requires a source namespace.');
export const occupancyCorrection = z.object({ observation: occupancyInput, reason: correctionReason }).strict();
export type OccupancyInput = z.input<typeof occupancyInput>;
export type OccupancyPreview = {
  sourceRows: number;
  records: { row: number; data: OccupancyInput; energyUseId?: string }[];
  issues: RowIssue[];
};
export function mapOccupancyWorkbook(sheets: ImportSheet[]): OccupancyPreview {
  if (sheets.length !== 1 || !sheets[0].rows.length || sheets[0].rows.length > 240)
    throw new DomainError('OCCUPANCY_SHEET', 'Use one sheet with 1–240 occupancy rows.');
  const sheet = sheets[0];
  const fields = [
    'firstDay',
    'lastDay',
    'energyUseCode',
    'regularCount',
    'irregularCount',
    'source',
    'legacySource',
    'legacyId',
  ] as const;
  const headers = sheet.headers.map((h) => h.trim().toLowerCase());
  if (headers.length !== fields.length || fields.some((f) => headers.filter((h) => h === f.toLowerCase()).length !== 1))
    throw new DomainError('OCCUPANCY_HEADERS', `Use exactly: ${fields.join(', ')}.`);
  const result: OccupancyPreview = { sourceRows: sheet.rows.length, records: [], issues: [] };
  for (const row of sheet.rows) {
    const raw = Object.fromEntries(fields.map((f) => [f, row.cells[headers.indexOf(f.toLowerCase())] ?? '']));
    const input = { ...raw, regularCount: raw.regularCount || null, irregularCount: raw.irregularCount || null };
    const parsed = occupancyInput.safeParse(input);
    if (!parsed.success) {
      result.issues.push({
        row: row.row,
        field: 'occupancy',
        message: 'Invalid dates, count, end-use code or source. Counts must be whole numbers; blank means unknown.',
      });
      continue;
    }
    const data = {
      ...parsed.data,
      regularCount: parsed.data.regularCount === null ? null : String(parsed.data.regularCount),
      irregularCount: parsed.data.irregularCount === null ? null : String(parsed.data.irregularCount),
    };
    if (
      result.records.some(
        (r) =>
          r.data.energyUseCode === data.energyUseCode &&
          r.data.firstDay <= data.lastDay &&
          r.data.lastDay >= data.firstDay,
      )
    )
      result.issues.push({
        row: row.row,
        field: 'firstDay',
        message: 'Overlapping periods for this end use in the workbook.',
      });
    if (
      data.legacyId &&
      result.records.some((r) => r.data.legacySource === data.legacySource && r.data.legacyId === data.legacyId)
    )
      result.issues.push({ row: row.row, field: 'legacyId', message: 'Duplicate source identity in the workbook.' });
    result.records.push({ row: row.row, data });
  }
  return result;
}
