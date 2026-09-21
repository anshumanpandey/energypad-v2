import { z } from 'zod';
import { monthPeriod, correctionReason } from './energy';
import type { ImportSheet, RowIssue } from './sites';
import { DomainError } from './policy';
export const driverLabels = {
  POPULATION: 'Average population (people)',
  OPERATING_HOURS: 'Total operating hours (hours/month)',
} as const;
const value = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,3})?$/, 'Enter a non-negative value with up to 3 decimal places.');
const source = z.string().trim().min(3, 'Record the source of this value.').max(500);
export const observationInput = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, 'Use a month between 1900 and 2199.'),
    driver: z.enum(['POPULATION', 'OPERATING_HOURS']),
    value,
    source,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.driver !== 'OPERATING_HOURS' || !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(data.month)) return;
    const { start, end } = monthPeriod(data.month);
    if (Number(data.value) > (+end - +start) / 3600000)
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Operating hours cannot exceed the calendar hours in this month.',
      });
  });
export type ObservationInput = z.infer<typeof observationInput>;
const date = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');
export const scheduleInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    firstDay: date,
    lastDay: date,
    weeklyHours: value.refine((v) => Number(v) <= 168, 'Weekly hours cannot exceed 168.'),
    source,
  })
  .strict()
  .refine((v) => v.lastDay >= v.firstDay, 'The last day cannot precede the first day.');
export type DriverPreview = { records: { row: number; data: ObservationInput }[]; issues: RowIssue[] };
export function mapDriverWorkbook(sheets: ImportSheet[]): DriverPreview {
  if (sheets.length !== 1)
    throw new DomainError('DRIVER_SHEET', 'Use one sheet with month, driver, value and source columns.');
  const sheet = sheets[0];
  if (!sheet.rows.length || sheet.rows.length > 240)
    throw new DomainError('DRIVER_ROWS', 'Use 1–240 observation rows.');
  const headers = sheet.headers.map((h) => h.trim().toLowerCase());
  const fields = ['month', 'driver', 'value', 'source'] as const;
  if (headers.length !== 4 || fields.some((f) => headers.filter((h) => h === f).length !== 1))
    throw new DomainError(
      'DRIVER_HEADERS',
      'Use exactly month, driver, value and source columns. Credential columns are discarded.',
    );
  const result: DriverPreview = { records: [], issues: [] };
  const seen = new Set<string>();
  for (const row of sheet.rows) {
    const input = Object.fromEntries(fields.map((field) => [field, row.cells[headers.indexOf(field)] ?? '']));
    input.driver = input.driver.toUpperCase();
    const parsed = observationInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        result.issues.push({
          row: row.row,
          field: issue.path.join('.'),
          message: 'Missing or invalid observation. Check month, driver, range and source.',
        });
      continue;
    }
    const key = `${parsed.data.month}:${parsed.data.driver}`;
    if (seen.has(key))
      result.issues.push({ row: row.row, field: 'month', message: 'Duplicate driver/month in this workbook.' });
    seen.add(key);
    result.records.push({ row: row.row, data: parsed.data });
  }
  return result;
}

export const observationCorrectionInput = z
  .object({ observation: observationInput, reason: correctionReason })
  .strict();
export const scheduleCorrectionInput = z.object({ schedule: scheduleInput, reason: correctionReason }).strict();
