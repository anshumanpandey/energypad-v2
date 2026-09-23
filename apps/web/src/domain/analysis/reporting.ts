import { z } from 'zod';
import type { RegressionResult } from './regression';

const month = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
const id = z.string().trim().min(1).max(160);
const finite = z.number().finite();
const observed = finite.nonnegative().nullable();
const siteScope = z.object({ organisationId: z.uuid(), siteId: z.uuid() }).strict();
const meterScope = siteScope.extend({ meterId: z.uuid(), energyUseId: z.uuid().nullable() }).strict();
const period = z
  .object({ firstMonth: month, lastMonth: month })
  .strict()
  .refine((p) => p.firstMonth <= p.lastMonth);
const bounds = z
  .object({ min: finite, max: finite })
  .strict()
  .refine((b) => b.min <= b.max);
const modelSchema = z
  .object({
    algorithm: z.literal('ols-qr-experimental-v3'),
    compatibility: z.literal('UNVALIDATED'),
    responseUnit: z.literal('kWh'),
    fitPolicy: z.object({ version: id, relativeRankTolerance: finite.min(10 * Number.EPSILON).max(0.01) }).strict(),
    coefficients: z
      .array(z.object({ code: id, unit: id, value: finite, observedRange: bounds }).strict())
      .min(1)
      .max(3),
    center: z.object({ response: finite, drivers: z.array(finite).min(1).max(3) }).strict(),
    residualStandardError: finite.nonnegative(),
  })
  .strict();
const adjustmentObservation = z
  .object({
    id,
    scope: siteScope,
    month,
    kind: z.enum(['POPULATION', 'OPERATING_HOURS']),
    unit: z.enum(['people', 'hours']),
    value: observed,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.unit !== (v.kind === 'POPULATION' ? 'people' : 'hours'))
      ctx.addIssue({ code: 'custom', message: 'NRA observation unit does not match its kind.' });
    if (v.kind === 'OPERATING_HOURS' && v.value !== null) {
      const [year, m] = v.month.split('-').map(Number);
      const hours = new Date(Date.UTC(year, m, 0)).getUTCDate() * 24;
      if (v.value > hours) ctx.addIssue({ code: 'custom', message: 'Operating hours exceed this calendar month.' });
    }
  });
export const reportingInput = z
  .object({
    baseline: z
      .object({
        id,
        scope: meterScope,
        period,
        model: modelSchema,
        referenceObservations: z.array(adjustmentObservation).max(4800),
      })
      .strict(),
    period,
    policy: z
      .object({
        version: id,
        nra: z.enum(['NONE', 'HOURS', 'POPULATION', 'HOURS_AND_POPULATION']),
        significanceBasis: z.enum(['PRE_NRA', 'POST_NRA']),
        comparison: z.enum(['AT_LEAST', 'GREATER_THAN']),
        sigmaMultiplier: z.literal(2),
        zeroThreshold: z.enum(['UNDEFINED', 'COMPARE_NONZERO']),
        negativePrediction: z.enum(['BLOCK', 'ALLOW_WITH_WARNING']),
        extrapolation: z.enum(['BLOCK', 'ALLOW_WITH_WARNING']),
      })
      .strict(),
    rows: z
      .array(
        z
          .object({
            consumption: z.object({ id, scope: meterScope, month, kwh: observed }).strict(),
            drivers: z
              .array(z.object({ id, scope: siteScope, month, code: id, unit: id, value: finite.nullable() }).strict())
              .max(3),
            nraReferenceMonth: month.nullable(),
            nraObservations: z.array(adjustmentObservation).max(2),
          })
          .strict(),
      )
      .max(120),
  })
  .strict();
export type ReportingInput = z.input<typeof reportingInput>;
type Scope = z.output<typeof meterScope>;
export type ReportIssue = { month: string | null; code: string; message: string };
type CalculatedRow = {
  month: string;
  status: 'CALCULATED';
  actualKwh: number;
  consumptionId: string;
  driverIds: string[];
  expectedKwh: number;
  nraMultiplier: number;
  adjustedExpectedKwh: number;
  preNraVarianceKwh: number;
  postNraVarianceKwh: number;
  direction: 'SAVING' | 'WASTE' | 'NO_CHANGE';
  adjustments: {
    kind: string;
    referenceId: string;
    reportingId: string;
    referenceMonth: string;
    referenceValue: number;
    reportingValue: number;
    ratio: number;
  }[];
  significance: {
    basis: 'PRE_NRA' | 'POST_NRA';
    varianceKwh: number;
    thresholdKwh: number;
    significant: boolean | null;
  };
  warnings: string[];
};
export type ReportingResult = {
  algorithm: 'energy-reporting-experimental-v1';
  compatibility: 'UNVALIDATED';
} & (
  | { status: 'BLOCKED'; issues: ReportIssue[]; rows: [] }
  | {
      status: 'CALCULATED' | 'INCOMPLETE';
      inputSnapshot: z.output<typeof reportingInput>;
      issues: ReportIssue[];
      rows: (CalculatedRow | { month: string; status: 'BLOCKED'; issues: ReportIssue[] })[];
    }
);

/** Project a fitted model without treating the fit as approved or authorized. */
export function projectReportingModel(fit: RegressionResult): z.output<typeof modelSchema> | null {
  if (fit.status !== 'FITTED') return null;
  const result = modelSchema.safeParse({
    algorithm: fit.algorithm,
    compatibility: fit.compatibility,
    responseUnit: fit.responseUnit,
    fitPolicy: fit.policy,
    coefficients: fit.coefficients,
    center: fit.center,
    residualStandardError: fit.residualStandardError,
  });
  return result.success ? result.data : null;
}
const sameSite = (a: z.output<typeof siteScope>, b: z.output<typeof siteScope>) =>
  a.organisationId === b.organisationId && a.siteId === b.siteId;
const sameMeter = (a: Scope, b: Scope) => sameSite(a, b) && a.meterId === b.meterId && a.energyUseId === b.energyUseId;
const inside = (m: string, p: z.output<typeof period>) => m >= p.firstMonth && m <= p.lastMonth;
function months(p: z.output<typeof period>): string[] {
  const result: string[] = [];
  let [year, m] = p.firstMonth.split('-').map(Number);
  while (result.length <= 120) {
    const text = `${year}-${String(m).padStart(2, '0')}`;
    if (text > p.lastMonth) break;
    result.push(text);
    if (++m === 13) {
      m = 1;
      year++;
    }
  }
  return result;
}
function compensated(values: number[]) {
  let total = 0,
    correction = 0;
  for (const v of values) {
    const adjusted = v - correction,
      next = total + adjusted;
    correction = next - total - adjusted;
    total = next;
  }
  return total;
}

/** Pure, experimental reporting. Scope consistency checks are not user authorization. */
export function calculateReporting(input: unknown): ReportingResult {
  const metadata = { algorithm: 'energy-reporting-experimental-v1', compatibility: 'UNVALIDATED' } as const;
  const issue = (month: string | null, code: string, message: string): ReportIssue => ({ month, code, message });
  const blocked = (issues: ReportIssue[]): ReportingResult => ({ ...metadata, status: 'BLOCKED', issues, rows: [] });
  const parsed = reportingInput.safeParse(input);
  if (!parsed.success)
    return blocked([
      issue(null, 'INVALID_INPUT', 'Use valid months, scopes, finite values, units and explicit reporting policies.'),
    ]);
  const data = parsed.data,
    { baseline, policy } = data,
    model = baseline.model;
  const wanted = months(data.period);
  if (wanted.length > 120 || months(baseline.period).length > 120)
    return blocked([issue(null, 'PERIOD_LIMIT', 'Use at most 120 months per baseline/reporting period.')]);
  if (
    model.center.drivers.length !== model.coefficients.length ||
    new Set(model.coefficients.map((c) => c.code)).size !== model.coefficients.length
  )
    return blocked([
      issue(null, 'MODEL_SHAPE', 'Model coefficients and centers must use the same unique driver columns.'),
    ]);
  const global: ReportIssue[] = [];
  const byMonth = new Map<string, (typeof data.rows)[number]>();
  const sourceRows = new Map<string, string>();
  function identity(key: string, value: unknown, m: string) {
    const text = JSON.stringify(value);
    if (sourceRows.has(key) && sourceRows.get(key) !== text)
      global.push(issue(m, 'SOURCE_ID_CONFLICT', 'The same source revision ID describes different observations.'));
    sourceRows.set(key, text);
  }
  const references = new Map<string, (typeof baseline.referenceObservations)[number]>();
  for (const ref of baseline.referenceObservations) {
    if (!sameSite(ref.scope, baseline.scope) || !inside(ref.month, baseline.period))
      global.push(
        issue(ref.month, 'REFERENCE_SCOPE', 'NRA reference observations must belong to this site and baseline period.'),
      );
    const key = `${ref.month}:${ref.kind}`;
    if (references.has(key))
      global.push(issue(ref.month, 'DUPLICATE_REFERENCE', 'Duplicate NRA reference kind/month.'));
    references.set(key, ref);
    identity(`observation:${ref.id}`, ref, ref.month);
  }
  for (const row of data.rows) {
    const actual = row.consumption,
      m = actual.month;
    if (!sameMeter(actual.scope, baseline.scope))
      global.push(
        issue(m, 'CONSUMPTION_SCOPE', 'Consumption must match the baseline organisation, site, meter and end use.'),
      );
    if (!inside(m, data.period))
      global.push(issue(m, 'OUTSIDE_REPORTING_PERIOD', 'Consumption lies outside the declared reporting period.'));
    if (byMonth.has(m))
      global.push(issue(m, 'DUPLICATE_MONTH', 'Only one consumption row is allowed per reporting month.'));
    byMonth.set(m, row);
    identity(`consumption:${actual.id}`, actual, m);
    for (const d of row.drivers) {
      if (!sameSite(d.scope, baseline.scope) || d.month !== m)
        global.push(issue(m, 'DRIVER_SCOPE', 'Predictor observations must match this site and reporting month.'));
      identity(`predictor:${d.id}`, d, m);
    }
    for (const d of row.nraObservations) {
      if (!sameSite(d.scope, baseline.scope) || d.month !== m)
        global.push(issue(m, 'NRA_SCOPE', 'NRA observations must match this site and reporting month.'));
      identity(`observation:${d.id}`, d, m);
    }
  }
  if (global.length) return blocked(global);
  const required: ('OPERATING_HOURS' | 'POPULATION')[] =
    policy.nra === 'NONE'
      ? []
      : policy.nra === 'HOURS'
        ? ['OPERATING_HOURS']
        : policy.nra === 'POPULATION'
          ? ['POPULATION']
          : ['OPERATING_HOURS', 'POPULATION'];
  const results: (CalculatedRow | { month: string; status: 'BLOCKED'; issues: ReportIssue[] })[] = [];
  const allIssues: ReportIssue[] = [];
  for (const m of wanted) {
    const row = byMonth.get(m),
      errors: ReportIssue[] = [];
    const fail = (code: string, message: string) => errors.push(issue(m, code, message));
    if (!row) fail('MISSING_MONTH', 'No consumption row was supplied for this month.');
    else {
      if (row.consumption.kwh === null) fail('MISSING_ACTUAL', 'Actual consumption is unknown; it cannot become zero.');
      if (
        row.drivers.length !== model.coefficients.length ||
        new Set(row.drivers.map((d) => d.code)).size !== row.drivers.length
      )
        fail('DRIVER_SHAPE', 'Supply each selected model driver once.');
      const warnings: string[] = [];
      const aligned = model.coefficients.map((c) => row.drivers.find((d) => d.code === c.code));
      aligned.forEach((d, j) => {
        const c = model.coefficients[j];
        if (!d || d.value === null) fail('MISSING_DRIVER', `Missing ${c.code} observation.`);
        else if (d.unit !== c.unit) fail('DRIVER_UNIT', `Unit mismatch for ${c.code}.`);
        else if (d.value < c.observedRange.min || d.value > c.observedRange.max) {
          if (policy.extrapolation === 'BLOCK')
            fail('EXTRAPOLATION', `${c.code} lies outside the observed baseline range.`);
          else warnings.push(`EXTRAPOLATION:${c.code}`);
        }
      });
      if (new Set(row.nraObservations.map((d) => d.kind)).size !== row.nraObservations.length)
        fail('DUPLICATE_NRA', 'Supply each NRA observation kind once.');
      if (!required.length && (row.nraReferenceMonth !== null || row.nraObservations.length))
        fail('UNUSED_NRA', 'NRA is disabled; remove row adjustment inputs.');
      if (required.length && (!row.nraReferenceMonth || !inside(row.nraReferenceMonth, baseline.period)))
        fail('REFERENCE_MONTH', 'Choose an explicit NRA reference month within the baseline period.');
      const adjustments: CalculatedRow['adjustments'] = [];
      for (const kind of required) {
        const ref = references.get(`${row.nraReferenceMonth}:${kind}`),
          observed = row.nraObservations.find((d) => d.kind === kind);
        if (!ref || ref.value === null || !observed || observed.value === null)
          fail('MISSING_NRA', `Missing ${kind} reference/reporting observation.`);
        else if (ref.value === 0)
          fail('ZERO_NRA_DENOMINATOR', `${kind} reference is zero; an adjustment ratio is undefined.`);
        else {
          const ratio = observed.value / ref.value;
          if (!Number.isFinite(ratio) || (observed.value > 0 && ratio === 0))
            fail('NUMERICAL_RANGE', 'NRA ratio exceeds supported numerical range.');
          else
            adjustments.push({
              kind,
              referenceId: ref.id,
              reportingId: observed.id,
              referenceMonth: ref.month,
              referenceValue: ref.value,
              reportingValue: observed.value,
              ratio,
            });
        }
      }
      if (!errors.length) {
        const expected =
          model.center.response +
          compensated(aligned.map((d, j) => (d!.value! - model.center.drivers[j]) * model.coefficients[j].value));
        const multiplier = adjustments.reduce((value, a) => value * a.ratio, 1);
        const adjusted = expected * multiplier,
          actual = row.consumption.kwh!;
        const pre = expected - actual,
          post = adjusted - actual;
        const threshold = policy.sigmaMultiplier * model.residualStandardError;
        if (
          ![expected, multiplier, adjusted, pre, post, threshold].every(Number.isFinite) ||
          (multiplier === 0 && adjustments.every((a) => a.ratio !== 0)) ||
          (adjusted === 0 && expected !== 0 && multiplier !== 0)
        )
          fail('NUMERICAL_RANGE', 'Reporting arithmetic exceeds supported numerical range.');
        if (expected < 0) {
          if (policy.negativePrediction === 'BLOCK')
            fail('NEGATIVE_PREDICTION', 'Model predicts negative consumption.');
          else warnings.push('NEGATIVE_PREDICTION');
        }
        if (!errors.length) {
          const variance = policy.significanceBasis === 'POST_NRA' ? post : pre;
          const significant =
            threshold === 0 && policy.zeroThreshold === 'UNDEFINED'
              ? null
              : variance === 0
                ? false
                : policy.comparison === 'AT_LEAST'
                  ? Math.abs(variance) >= threshold
                  : Math.abs(variance) > threshold;
          if (threshold === 0) warnings.push('ZERO_SIGNIFICANCE_THRESHOLD');
          results.push({
            month: m,
            status: 'CALCULATED',
            actualKwh: actual,
            consumptionId: row.consumption.id,
            driverIds: aligned.map((d) => d!.id),
            expectedKwh: expected,
            nraMultiplier: multiplier,
            adjustedExpectedKwh: adjusted,
            preNraVarianceKwh: pre,
            postNraVarianceKwh: post,
            direction: post > 0 ? 'SAVING' : post < 0 ? 'WASTE' : 'NO_CHANGE',
            adjustments,
            significance: {
              basis: policy.significanceBasis,
              varianceKwh: variance,
              thresholdKwh: threshold,
              significant,
            },
            warnings,
          });
        }
      }
    }
    if (errors.length) {
      results.push({ month: m, status: 'BLOCKED', issues: errors });
      allIssues.push(...errors);
    }
  }
  return {
    ...metadata,
    status: allIssues.length ? 'INCOMPLETE' : 'CALCULATED',
    inputSnapshot: data,
    issues: allIssues,
    rows: results,
  };
}
