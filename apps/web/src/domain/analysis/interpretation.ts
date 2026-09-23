import type { RegressionResult } from './regression';

/** Presentation policy, separate from the numerical kernel and workbook acceptance. */
export const interpretationPolicy = {
  version: 'statistical-interpretation-v1',
  status: 'PROVISIONAL',
  pValueSource: 'Master V2 specification: inclusive 0.01 and 0.05 boundaries',
  rSquaredSource: 'NRA V2 workbook K41: inclusive 0.90, 0.80 and 0.75 boundaries',
  pBands: [
    { maximumInclusive: 0.01, code: 'VERY_SIGNIFICANT', label: 'Very significant' },
    { maximumInclusive: 0.05, code: 'SIGNIFICANT', label: 'Significant' },
    { maximumInclusive: 1, code: 'NOT_SIGNIFICANT', label: 'Not significant' },
  ],
  rSquaredBands: [
    { minimumInclusive: 0.9, code: 'VERY_STRONG', label: 'Very strong' },
    { minimumInclusive: 0.8, code: 'STRONG', label: 'Strong' },
    { minimumInclusive: 0.75, code: 'ACCEPTABLE', label: 'Acceptable' },
  ],
  rSquaredFallback: { code: 'UNRELIABLE', label: 'Unreliable' },
} as const;
export type InterpretationPolicy = {
  version: string;
  status: string;
  pValueSource: string;
  rSquaredSource: string;
  pBands: readonly { maximumInclusive: number; code: string; label: string }[];
  rSquaredBands: readonly { minimumInclusive: number; code: string; label: string }[];
  rSquaredFallback: { code: string; label: string };
};
type Verdict = { code: string; label: string };
const unavailable = (reason: string): Verdict => ({ code: 'UNAVAILABLE', label: `Unavailable: ${reason}` });
export function interpretRegression(
  fit: Extract<RegressionResult, { status: 'FITTED' }>,
  policy: InterpretationPolicy = interpretationPolicy,
) {
  const rSquared =
    fit.rSquared === null || !Number.isFinite(fit.rSquared) || fit.rSquared > 1
      ? unavailable('R² is undefined')
      : (policy.rSquaredBands.find((b) => fit.rSquared! >= b.minimumInclusive) ?? policy.rSquaredFallback);
  const terms = [
    { kind: 'INTERCEPT' as const, driverCode: null },
    ...fit.coefficients.map((c) => ({ kind: 'DRIVER' as const, driverCode: c.code })),
  ];
  return {
    // Copy policy data so future configuration changes cannot mutate a prepared snapshot.
    policy: structuredClone(policy),
    rSquared: { code: rSquared.code, label: rSquared.label },
    coefficients: terms.map((term) => {
      const statistic = fit.inference.terms.find((t) => t.kind === term.kind && t.driverCode === term.driverCode);
      const p = statistic?.probability;
      let verdict = unavailable('coefficient inference is unavailable');
      if (p?.status === 'OK' && Number.isFinite(p.value) && p.value >= 0 && p.value <= 1) {
        const band = policy.pBands.find((b) => p.value <= b.maximumInclusive);
        if (band) verdict = { code: band.code, label: band.label };
      } else if (p?.status === 'ZERO_RESIDUAL_VARIANCE') verdict = unavailable('zero residual variance');
      else if (p?.status === 'UNDERFLOW') verdict = unavailable('probability is below numeric range');
      else if (p?.status === 'T_OVERFLOW') verdict = unavailable('t statistic exceeds numeric range');
      return { ...term, ...verdict };
    }),
  };
}
export type RegressionInterpretation = ReturnType<typeof interpretRegression>;
