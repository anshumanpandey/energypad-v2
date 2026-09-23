import { studentTTwoSided, type TailProbability } from './student-t';
export type CoefficientStatistic = {
  kind: 'INTERCEPT' | 'DRIVER';
  driverCode: string | null;
  estimate: number;
  standardError: number;
  tStatistic: number | null;
  probability: TailProbability | { status: 'ZERO_RESIDUAL_VARIANCE' | 'T_OVERFLOW'; value: null; logValue: null };
};
export type RegressionInference =
  | { status: 'AVAILABLE' | 'ZERO_RESIDUAL_VARIANCE'; covariance: number[][]; terms: CoefficientStatistic[] }
  | { status: 'NUMERICAL_RANGE'; covariance: null; terms: [] };

/** Internal: reuse the fitted QR factors; no inversion of X'X or refitting. */
export function coefficientInference(
  triangular: number[][],
  permutation: number[],
  scales: number[],
  means: number[],
  sigma: number,
  df: number,
  n: number,
  intercept: number,
  slopes: number[],
  codes: string[],
): RegressionInference {
  const k = slopes.length;
  const fail = (): RegressionInference => ({ status: 'NUMERICAL_RANGE', covariance: null, terms: [] });
  const inverse = Array.from({ length: k }, () => Array<number>(k).fill(0));
  for (let column = 0; column < k; column++) {
    for (let row = k - 1; row >= 0; row--) {
      let rhs = row === column ? 1 : 0;
      for (let j = row + 1; j < k; j++) rhs -= triangular[row][j] * inverse[j][column];
      inverse[row][column] = rhs / triangular[row][row];
    }
  }
  const factors = Array.from({ length: k + 1 }, () => Array<number>(k + 1).fill(0));
  for (let pivot = 0; pivot < k; pivot++) {
    const original = permutation[pivot];
    for (let j = 0; j < k; j++) factors[original + 1][j + 1] = (inverse[pivot][j] * sigma) / scales[original];
  }
  factors[0][0] = sigma / Math.sqrt(n);
  for (let j = 1; j <= k; j++) {
    for (let i = 0; i < k; i++) factors[0][j] -= means[i] * factors[i + 1][j];
  }
  const covariance = factors.map((row) =>
    factors.map((other) => row.reduce((sum, value, j) => sum + value * other[j], 0)),
  );
  const errors = factors.map((row) => Math.hypot(...row));
  if (
    !covariance.flat().every(Number.isFinite) ||
    !errors.every(Number.isFinite) ||
    (sigma > 0 && errors.some((value, i) => value === 0 || covariance[i][i] === 0))
  )
    return fail();
  const terms = [intercept, ...slopes].map((estimate, i): CoefficientStatistic => {
    const standardError = errors[i];
    const t = estimate / standardError;
    const probability: CoefficientStatistic['probability'] =
      sigma === 0
        ? { status: 'ZERO_RESIDUAL_VARIANCE', value: null, logValue: null }
        : !Number.isFinite(t)
          ? { status: 'T_OVERFLOW', value: null, logValue: null }
          : studentTTwoSided(t, df);
    return {
      kind: i === 0 ? 'INTERCEPT' : 'DRIVER',
      driverCode: i === 0 ? null : codes[i - 1],
      estimate,
      standardError,
      tStatistic: sigma === 0 || !Number.isFinite(t) ? null : t,
      probability,
    };
  });
  return { status: sigma === 0 ? 'ZERO_RESIDUAL_VARIANCE' : 'AVAILABLE', covariance, terms };
}
