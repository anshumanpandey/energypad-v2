import { z } from 'zod';
import { fuels } from './tariffs';
import { uuid } from './policy';
export const monthlyAmount = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,9})?$/, 'Use a non-negative amount with up to nine decimals.');
export const monthlyPlanInput = z
  .object({
    kind: z.enum(['TARGET', 'MONITORING']),
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2]|ALL)$/),
    fuel: z.enum(fuels),
    unit: z.enum(['kWh', 'MWh', 'm3', 'litre', 'kg']),
    energy: monthlyAmount,
    carbon: z.union([monthlyAmount, z.literal('')]).default(''),
    conversionFactor: monthlyAmount.refine((v) => Number(v) > 0, 'The conversion factor must be positive.'),
    source: z.string().trim().min(3).max(1000),
    energyUseCodes: z.string().trim().max(1000).default(''),
    externalLegacyId: z.string().trim().max(160).default(''),
    requestKey: uuid,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.unit === 'kWh' && Number(v.conversionFactor) !== 1) ||
      (v.unit === 'MWh' && Number(v.conversionFactor) !== 1000)
    )
      ctx.addIssue({ code: 'custom', message: 'Use conversion factor 1 for kWh or 1000 for MWh.' });
    if (v.kind === 'TARGET' && v.energyUseCodes)
      ctx.addIssue({
        code: 'custom',
        message: 'End-use associations belong to monitoring records, not consumption targets.',
      });
    if (v.kind === 'MONITORING' && v.carbon === '')
      ctx.addIssue({ code: 'custom', message: 'Monitoring requires an explicit carbon value in kgCO2e.' });
  });
export function expandPlanMonths(month: string) {
  return month.endsWith('-ALL')
    ? Array.from({ length: 12 }, (_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
    : [month];
}
export type MonthlyPlanPayload = z.infer<typeof monthlyPlanInput> & {
  normalizedKwh: string;
  conversionVersion: 'monthly-plan-explicit-v1';
  energyUses: { id: string; code: string; name: string }[];
};

export const monthlyPlanCorrection = z
  .object({ plan: monthlyPlanInput, reason: z.string().trim().min(3).max(1000) })
  .strict();
