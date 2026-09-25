import { z } from 'zod';
import { fuels } from './tariffs';
import { correctionReason } from './energy';
const date = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');
export const factorBases = ['LOCATION_BASED', 'MARKET_BASED', 'DIRECT'] as const;
export const emissionFactorInput = z
  .object({
    fuel: z.enum(fuels),
    geography: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,40}$/, 'Use a country or region code.'),
    basis: z.enum(factorBases),
    unit: z.literal('kgCO2e/kWh'),
    factor: z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,9})?$/, 'Enter a non-negative factor with up to nine decimal places.'),
    source: z.string().trim().min(3).max(1000),
    firstDay: date,
    lastDay: date,
  })
  .strict()
  .refine((v) => v.lastDay >= v.firstDay, 'Last day cannot precede first day.');
export const emissionFactorCorrectionInput = z
  .object({ factor: emissionFactorInput, reason: correctionReason })
  .strict();
