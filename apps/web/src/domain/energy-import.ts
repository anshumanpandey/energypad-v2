import { z } from 'zod';
import { consumptionInput } from './energy';
import type { ImportSheet, RowIssue } from './sites';
import { DomainError } from './policy';
export const energyImportFields = [
  'month',
  'quantity',
  'unit',
  'netCost',
  'vatPercent',
  'currency',
  'endUse',
  'energyUseCode',
  'externalLegacyId',
] as const;
// Older saved mappings can still be loaded; reading status no longer affects imports.
function withoutLegacyReadingStatus(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'estimated'));
}
export const energyMappingInput = z
  .object({
    sheet: z.number().int().min(0).max(9),
    columns: z.preprocess(
      withoutLegacyReadingStatus,
      z.partialRecord(z.enum(energyImportFields), z.number().int().min(0).max(49)),
    ),
    defaults: z.preprocess(
      withoutLegacyReadingStatus,
      z.partialRecord(z.enum(energyImportFields), z.string().max(500)),
    ),
    confirmed: z.literal(true),
  })
  .strict();
export type EnergyMapping = z.output<typeof energyMappingInput>;
export function mapEnergyRows(sheets: ImportSheet[], mapping: EnergyMapping, meterId: string, meterUnit: string) {
  const sheet = sheets[mapping.sheet];
  if (!sheet || !sheet.rows.length || sheet.rows.length > 120)
    throw new DomainError('SHEET_ROWS', 'Choose a sheet with 1–120 monthly readings for one meter.');
  if (Object.values(mapping.columns).some((index) => index >= sheet.headers.length))
    throw new DomainError('COLUMN', 'A mapped column is not available in this sheet.');
  const issues: RowIssue[] = [];
  const records: { row: number; data: z.output<typeof consumptionInput> }[] = [];
  const months = new Set<string>();
  for (const row of sheet.rows) {
    const values = Object.fromEntries(
      energyImportFields.map((field) => {
        const index = mapping.columns[field];
        return [field, (index === undefined ? (mapping.defaults[field] ?? '') : (row.cells[index] ?? '')).trim()];
      }),
    );
    if (values.unit !== meterUnit)
      issues.push({ row: row.row, field: 'unit', message: `Source unit must match this meter (${meterUnit}).` });
    const parsed = consumptionInput.safeParse({
      meterId,
      month: values.month,
      quantity: values.quantity,
      netCost: values.netCost || null,
      vatPercent: values.vatPercent || null,
      currency: values.currency || null,
      endUse: values.endUse,
      energyUseCode: values.energyUseCode || null,
      externalLegacyId: values.externalLegacyId,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        issues.push({ row: row.row, field: String(issue.path[0] ?? 'row'), message: issue.message });
      continue;
    }
    if (months.has(parsed.data.month))
      issues.push({ row: row.row, field: 'month', message: 'Duplicate month in this sheet.' });
    months.add(parsed.data.month);
    records.push({ row: row.row, data: parsed.data });
  }
  return { records, issues };
}
