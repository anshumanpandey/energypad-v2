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
const days = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/)
  .refine((v) => Number(v) <= 366, 'Annual active days must be between 0 and 366.')
  .nullable();
const temperature = z
  .string()
  .trim()
  .regex(/^-?\d{1,3}(\.\d{1,3})?$/, 'Use a temperature with up to three decimal places.')
  .nullable();
export const patternInput = z
  .object({
    firstDay: date,
    lastDay: date,
    energyUseCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,39}$/),
    daysOnYear: days,
    temperature,
    temperatureUnit: z.enum(['C', 'F', 'UNKNOWN']),
    temperatureContext: z.enum(['HEATING', 'COOLING', 'OTHER', 'UNKNOWN']),
    source: z.string().trim().min(3).max(500),
    legacySource: z.string().trim().max(100).default(''),
    legacyId: z.string().trim().max(160).default(''),
  })
  .strict()
  .refine((v) => v.lastDay >= v.firstDay, 'Last day must follow first day.')
  .refine(
    (v) => v.temperature !== null || (v.temperatureUnit === 'UNKNOWN' && v.temperatureContext === 'UNKNOWN'),
    'Leave unit/context unknown when no temperature is supplied.',
  )
  .refine((v) => !v.legacyId || !!v.legacySource, 'A legacy ID requires a source namespace.');
export const patternCorrection = z.object({ observation: patternInput, reason: correctionReason }).strict();
export type PatternInput = z.input<typeof patternInput>;
export type PatternPreview = {
  sourceRows: number;
  records: { row: number; data: PatternInput; energyUseId?: string; warnings: string[] }[];
  issues: RowIssue[];
};
export function mapPatternWorkbook(sheets: ImportSheet[]): PatternPreview {
  if (sheets.length !== 1 || !sheets[0].rows.length || sheets[0].rows.length > 240)
    throw new DomainError('PATTERN_SHEET', 'Use one sheet with 1–240 pattern rows.');
  const sheet = sheets[0];
  const fields = [
    'firstDay',
    'lastDay',
    'energyUseCode',
    'daysOnYear',
    'temperature',
    'temperatureUnit',
    'temperatureContext',
    'source',
    'legacySource',
    'legacyId',
  ] as const;
  const headers = sheet.headers.map((h) => h.trim().toLowerCase());
  if (headers.length !== fields.length || fields.some((f) => headers.filter((h) => h === f.toLowerCase()).length !== 1))
    throw new DomainError('PATTERN_HEADERS', `Use exactly: ${fields.join(', ')}.`);
  const result: PatternPreview = { sourceRows: sheet.rows.length, records: [], issues: [] };
  for (const row of sheet.rows) {
    const raw = Object.fromEntries(fields.map((f) => [f, row.cells[headers.indexOf(f.toLowerCase())] ?? '']));
    const input = { ...raw, daysOnYear: raw.daysOnYear || null, temperature: raw.temperature || null };
    const parsed = patternInput.safeParse(input);
    if (!parsed.success) {
      result.issues.push({
        row: row.row,
        field: 'pattern',
        message: 'Invalid dates, annual days, temperature, unit/context, end-use code or source.',
      });
      continue;
    }
    const data = parsed.data;
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
    result.records.push({ row: row.row, data, warnings: patternWarnings(data) });
  }
  return result;
}

export function patternWarnings(
  data: Pick<
    z.output<typeof patternInput>,
    'firstDay' | 'lastDay' | 'daysOnYear' | 'temperature' | 'temperatureUnit' | 'temperatureContext'
  >,
): string[] {
  const result: string[] = [];
  if (data.daysOnYear === null) result.push('Annual active days are unknown.');
  else if (Number(data.daysOnYear) > (+new Date(data.lastDay) - +new Date(data.firstDay)) / 86400000 + 1)
    result.push(
      'Annual active days exceed this validity interval. Retain the source value and review its annual basis; do not prorate automatically.',
    );
  if (data.temperature === null) result.push('Temperature/setpoint is unknown.');
  else if (data.temperatureUnit === 'UNKNOWN' || data.temperatureContext === 'UNKNOWN')
    result.push('Temperature unit or context is unresolved; this value cannot be used as a weather base.');
  return result;
}
