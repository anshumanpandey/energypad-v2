import { z } from 'zod';
import { uuid } from './policy';

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,3})?$/, 'Enter a non-negative number with up to 3 decimal places.');
export const consumptionInput = z
  .object({
    meterId: uuid,
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, 'Choose a month between 1900 and 2199.'),
    quantity: amount,
    estimated: z.boolean().default(false),
    netCost: amount.nullish().transform((v) => v ?? null),
    vatPercent: amount
      .refine((v) => Number(v) <= 100, 'VAT must be between 0 and 100.')
      .nullish()
      .transform((v) => v ?? null),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .nullish()
      .transform((v) => v ?? null),
    endUse: z.string().trim().max(100).default(''),
    externalLegacyId: z.string().trim().max(160).default(''),
  })
  .strict()
  .refine((v) => v.netCost === null || v.currency !== null, 'Choose a currency when entering cost.');

export function monthPeriod(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
export const energyConversions = {
  kWh: { factor: '1', version: 'energy-si-v1' },
  MWh: { factor: '1000', version: 'energy-si-v1' },
} as const;
export function missingMonths(year: number, months: string[]) {
  const present = new Set(months);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter(
    (m) => !present.has(m),
  );
}

const conversionMonth = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, 'Choose a month between 1900 and 2199.');
export const conversionInput = z
  .object({
    meterId: uuid,
    firstMonth: conversionMonth,
    lastMonth: conversionMonth,
    factor: z
      .string()
      .trim()
      .regex(/^\d{1,6}(\.\d{1,6})?$/, 'Use up to 6 decimal places.')
      .refine((v) => Number(v) > 0 && Number(v) <= 100000, 'The factor must be greater than zero and at most 100000.'),
    source: z.string().trim().min(3, 'Record the source of this factor.').max(500),
  })
  .strict()
  .refine((v) => v.lastMonth >= v.firstMonth, 'The last month must not precede the first month.');
