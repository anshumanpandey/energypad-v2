import { fuels } from './fuels';
import { z } from 'zod';
import { uuid } from './policy';
const text = (max = 160) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const decimal = (max: number) =>
  z
    .string()
    .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Use a non-negative number with up to 3 decimal places.')
    .refine((v) => Number(v) <= max, `Maximum is ${max}.`)
    .nullish()
    .transform((v) => v ?? null);
export const attributesInput = z
  .object({
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
        'Choose a valid effective date.',
      ),
    population: decimal(99999999999),
    floorArea: decimal(99999999999),
    weeklyHours: decimal(168),
    vatPercent: decimal(100),
  })
  .strict();
export const siteInput = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(2).max(160),
    portfolioId: uuid.nullish().transform((v) => v ?? null),
    type: text(),
    address: text(300),
    addressLine2: text(300),
    postCode: text(32),
    town: text(),
    country: text(100),
    region: text(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .nullish()
      .transform((v) => v ?? null),
    externalLegacyId: text(),
    attributes: attributesInput.optional(),
  })
  .strict();
export const portfolioInput = z.object({ name: z.string().trim().min(2).max(160) }).strict();
export const meterInput = z
  .object({
    code: z.string().trim().min(1, 'Meter code is required.').max(80, 'Meter code must be at most 80 characters.'),
    name: z
      .string()
      .trim()
      .min(2, 'Meter name must contain at least 2 characters.')
      .max(160, 'Meter name must be at most 160 characters.'),
    fuel: z.enum(fuels),
    unit: z.enum(['kWh', 'MWh', 'm3', 'litre', 'kg']),
  })
  .strict();
export type SiteInput = z.output<typeof siteInput>;
export const manualSiteInput = siteInput.omit({ code: true });
// Labels and aliases shared by manual entry and the supplied site workbook.
export const siteTemplateFields = [
  ['name', 'Site Name'],
  ['address', 'Address Line 1'],
  ['addressLine2', 'Address Line 2'],
  ['town', 'City'],
  ['region', 'State'],
  ['postCode', 'Postcode'],
] as const;
export const siteTemplateAttributeFields = [
  ['population', 'Population'],
  ['weeklyHours', 'Work Hours per week'],
] as const;
export function siteColumnIndex(headers: string[], field: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string[]> = {
    name: ['Site Name', 'name'],
    address: ['Address Line 1', 'address'],
    addressLine2: ['Address Line 2'],
    town: ['City', 'town'],
    region: ['State', 'region'],
    weeklyHours: ['Work Hours per week', 'workinghours', 'weeklyHours'],
    floorArea: ['size', 'floorArea'],
  };
  return headers.findIndex((header) =>
    (aliases[field] ?? [field]).some((alias) => normalize(header) === normalize(alias)),
  );
}
export const importFields = [
  'code',
  'name',
  'type',
  'address',
  'addressLine2',
  'postCode',
  'town',
  'country',
  'region',
  'currency',
  'externalLegacyId',
  'population',
  'floorArea',
  'weeklyHours',
  'vatPercent',
] as const;
export const mappingInput = z
  .object({
    sheet: z.number().int().min(0).max(9),
    columns: z.partialRecord(z.enum(importFields), z.number().int().min(0).max(49)),
    defaults: z.partialRecord(z.enum(importFields), z.string().max(300)),
    codePrefix: z.string().trim().max(35).default(''),
    effectiveFrom: z.string().default(''),
    businessEmail: z.string().trim().toLowerCase().email().or(z.literal('')).default(''),
    confirmCurrentOrganisation: z.literal(true),
  })
  .strict();
export type ImportMapping = z.output<typeof mappingInput>;
export type ImportSheet = { name: string; headers: string[]; rows: { row: number; cells: string[] }[] };
export type RowIssue = { row: number; field: string; message: string };
