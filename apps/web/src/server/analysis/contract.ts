import { createHash } from 'node:crypto';
import { z } from 'zod';
import { reportingInput } from '../../domain/analysis/reporting';
import { monthPeriod } from '../../domain/energy';
import { weatherMethod } from '../../domain/weather';
export const analysisPeriod = z
  .object({
    firstMonth: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    lastMonth: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
  })
  .strict()
  .refine(
    (p) => p.firstMonth <= p.lastMonth && periodMonths(p).length <= 120,
    'Use an ordered period of at most 120 months.',
  );
export function periodMonths(p: { firstMonth: string; lastMonth: string }) {
  const result: string[] = [];
  let [y, m] = p.firstMonth.split('-').map(Number);
  while (result.length <= 120) {
    const value = `${y}-${String(m).padStart(2, '0')}`;
    if (value > p.lastMonth) break;
    result.push(value);
    if (++m > 12) {
      y++;
      m = 1;
    }
  }
  return result;
}
export const driverDefinitions = {
  HDD: { unit: 'C·day', field: 'heatingDegreeDays' },
  CDD: { unit: 'C·day', field: 'coolingDegreeDays' },
  DAYLIGHT: { unit: 'hours', field: 'daylightHours' },
  POPULATION: { unit: 'people', field: null },
  OPERATING_HOURS: { unit: 'hours', field: null },
} as const;
export const baselineDefinition = z
  .object({
    meterId: z.uuid(),
    energyUseId: z.uuid().nullable(),
    period: analysisPeriod,
    drivers: z
      .array(z.enum(['HDD', 'CDD', 'DAYLIGHT', 'POPULATION', 'OPERATING_HOURS']))
      .min(1)
      .max(3),
    weather: z
      .object({ configurationId: z.uuid(), methodology: z.literal(weatherMethod) })
      .strict()
      .nullable(),
    fitPolicy: z
      .object({
        version: z.string().trim().min(1).max(100),
        relativeRankTolerance: z
          .number()
          .finite()
          .min(10 * Number.EPSILON)
          .max(0.01),
      })
      .strict(),
    estimatedConsumption: z.enum(['BLOCK', 'ALLOW_WITH_WARNING']),
    supersedesId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (new Set(d.drivers).size !== d.drivers.length)
      ctx.addIssue({ code: 'custom', message: 'Choose unique drivers.' });
    if (d.drivers.some((code) => driverDefinitions[code].field !== null) !== (d.weather !== null))
      ctx.addIssue({ code: 'custom', message: 'Choose a weather configuration exactly when using weather drivers.' });
  });
export const runDefinition = z
  .object({
    period: analysisPeriod,
    policy: reportingInput.shape.policy,
    references: z
      .array(
        z.object({ month: analysisPeriod.shape.firstMonth, referenceMonth: analysisPeriod.shape.firstMonth }).strict(),
      )
      .max(120),
  })
  .strict()
  .superRefine((d, ctx) => {
    const wanted = periodMonths(d.period);
    if (
      new Set(d.references.map((r) => r.month)).size !== d.references.length ||
      d.references.some((r) => !wanted.includes(r.month)) ||
      (d.policy.nra === 'NONE' ? d.references.length !== 0 : d.references.length !== wanted.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Map each reporting month once when NRA is enabled; omit mappings otherwise.',
      });
  });
export type BaselineDefinition = z.infer<typeof baselineDefinition>;
export type RunDefinition = z.infer<typeof runDefinition>;
export type ReadinessIssue = { month: string | null; code: string; message: string };
export const dateRange = (period: z.infer<typeof analysisPeriod>) => ({
  gte: monthPeriod(period.firstMonth).start,
  lt: monthPeriod(period.lastMonth).end,
});
/** Object keys are canonical; array order (including predictor order) is meaningful. */
export function snapshotHash(value: unknown): string {
  function encode(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('Nonfinite snapshot value');
      return JSON.stringify(v);
    }
    if (typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(encode).join(',')}]`;
    if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype)
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${encode((v as Record<string, unknown>)[k])}`)
        .join(',')}}`;
    throw new Error('Snapshot must contain only explicit JSON values');
  }
  return createHash('sha256').update(encode(value)).digest('hex');
}

export const historyPageInput = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();
