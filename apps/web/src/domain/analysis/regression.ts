import { coefficientInference, type RegressionInference } from './inference';
import { z } from 'zod';

const algorithm = 'ols-qr-experimental-v3' as const;
const inputSchema = z
  .object({
    responseUnit: z.string().trim().min(1).max(80),
    drivers: z
      .array(z.object({ code: z.string().trim().min(1).max(80), unit: z.string().trim().min(1).max(80) }).strict())
      .min(1)
      .max(3),
    observations: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(160),
            response: z.number().finite(),
            drivers: z.array(z.number().finite()).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(2400),
    policy: z
      .object({
        version: z.string().trim().min(1).max(100),
        relativeRankTolerance: z
          .number()
          .finite()
          .min(Number.EPSILON * 10)
          .max(0.01),
      })
      .strict(),
  })
  .strict();
export type RegressionInput = z.input<typeof inputSchema>;
type BlockReason =
  | 'INVALID_INPUT'
  | 'DUPLICATE_ID'
  | 'DRIVER_SHAPE'
  | 'INSUFFICIENT_OBSERVATIONS'
  | 'RANK_DEFICIENT'
  | 'NUMERICAL_RANGE';
export type RegressionResult = {
  algorithm: typeof algorithm;
  compatibility: 'UNVALIDATED';
} & (
  | { status: 'BLOCKED'; reason: BlockReason; message: string }
  | {
      status: 'FITTED';
      policy: RegressionInput['policy'];
      responseUnit: string;
      sampleSize: number;
      rank: number;
      residualDegreesOfFreedom: number;
      intercept: number;
      inference: RegressionInference;
      coefficients: { code: string; unit: string; value: number; observedRange: { min: number; max: number } }[];
      // Preserve centered form for later predictions with large predictor offsets.
      center: { response: number; drivers: number[] };
      rows: { id: string; actual: number; fitted: number; residual: number }[];
      ssResidual: number;
      ssTotal: number;
      rSquared: number | null;
      residualStandardError: number;
      warnings: ('CONSTANT_RESPONSE' | 'NEGATIVE_FITTED_VALUE')[];
    }
);

function sum(values: number[]) {
  let total = 0,
    correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = total + adjusted;
    correction = next - total - adjusted;
    total = next;
  }
  return total;
}
const finite = (values: number[]) => values.every(Number.isFinite);
const norm = (values: number[]) => Math.hypot(...values);
const block = (reason: BlockReason, message: string): RegressionResult => ({
  algorithm,
  compatibility: 'UNVALIDATED',
  status: 'BLOCKED',
  reason,
  message,
});

/** Experimental OLS with intercept, centered/scaled predictors and pivoted Householder QR.
 * No DB, workbook, weather, implicit policy, p-value labels, NRA or runtime-app callers.
 * Policy version records the caller's numerical choice; it is not an approval token.
 */
export function fitRegression(input: unknown): RegressionResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return block(
      'INVALID_INPUT',
      'Supply finite observations, one to three drivers, units and an explicit numerical policy.',
    );
  const data = parsed.data;
  const k = data.drivers.length,
    n = data.observations.length;
  if (new Set(data.drivers.map((d) => d.code)).size !== k || new Set(data.observations.map((r) => r.id)).size !== n)
    return block('DUPLICATE_ID', 'Driver codes and observation IDs must be unique.');
  if (data.observations.some((r) => r.drivers.length !== k))
    return block('DRIVER_SHAPE', 'Every observation must contain the same ordered driver columns.');
  if (n <= k + 1)
    return block(
      'INSUFFICIENT_OBSERVATIONS',
      'Positive residual degrees of freedom require more observations than fitted parameters.',
    );
  // Stable calculation order independent of input row ordering; presentation retains input order.
  const ordered = [...data.observations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const means = data.drivers.map((_, j) => sum(ordered.map((r) => r.drivers[j] / n)));
  const constant = ordered.every((r) => r.response === ordered[0].response);
  const meanY = constant ? ordered[0].response : sum(ordered.map((r) => r.response / n));
  if (data.drivers.some((_, j) => ordered.every((r) => r.drivers[j] === ordered[0].drivers[j])))
    return block('RANK_DEFICIENT', 'A constant driver cannot be fitted alongside an intercept.');
  const centered = ordered.map((r) => r.drivers.map((v, j) => v - means[j]));
  const y = ordered.map((r) => r.response - meanY);
  const scales = means.map((_, j) => norm(centered.map((r) => r[j])));
  if (!finite([...means, meanY, ...scales, ...y]))
    return block('NUMERICAL_RANGE', 'Centering exceeds the supported numerical range.');
  if (scales.some((s) => s === 0))
    return block('RANK_DEFICIENT', 'A constant driver cannot be fitted alongside an intercept.');
  const matrix = centered.map((r) => r.map((v, j) => v / scales[j]));
  const rhs = [...y];
  const permutation = Array.from({ length: k }, (_, j) => j);
  let firstPivot = 0;
  for (let j = 0; j < k; j++) {
    let pivot = j;
    let largest = -1;
    for (let c = j; c < k; c++) {
      const length = norm(matrix.slice(j).map((r) => r[c]));
      if (length > largest) {
        largest = length;
        pivot = c;
      }
    }
    if (j === 0) firstPivot = largest;
    if (!Number.isFinite(largest))
      return block('NUMERICAL_RANGE', 'QR factorization exceeded the supported numerical range.');
    if (largest <= data.policy.relativeRankTolerance * firstPivot)
      return block(
        'RANK_DEFICIENT',
        'Drivers are dependent or too close to dependent under the selected rank tolerance.',
      );
    if (pivot !== j) {
      for (const row of matrix) [row[j], row[pivot]] = [row[pivot], row[j]];
      [permutation[j], permutation[pivot]] = [permutation[pivot], permutation[j]];
    }
    const vector = matrix.slice(j).map((r) => r[j]);
    const diagonal = vector[0] >= 0 ? -largest : largest;
    vector[0] -= diagonal;
    const length = norm(vector);
    for (let i = 0; i < vector.length; i++) vector[i] /= length;
    for (let c = j; c < k; c++) {
      const projection = 2 * sum(vector.map((v, i) => v * matrix[j + i][c]));
      for (let i = 0; i < vector.length; i++) matrix[j + i][c] -= projection * vector[i];
    }
    const projection = 2 * sum(vector.map((v, i) => v * rhs[j + i]));
    for (let i = 0; i < vector.length; i++) rhs[j + i] -= projection * vector[i];
    matrix[j][j] = diagonal;
    for (let i = j + 1; i < n; i++) matrix[i][j] = 0;
  }
  const solution = Array<number>(k).fill(0);
  for (let j = k - 1; j >= 0; j--) {
    solution[j] = (rhs[j] - sum(solution.slice(j + 1).map((v, i) => v * matrix[j][j + i + 1]))) / matrix[j][j];
  }
  const slopes = Array<number>(k).fill(0);
  for (let j = 0; j < k; j++) slopes[permutation[j]] = solution[j] / scales[permutation[j]];
  const intercept = meanY - sum(means.map((v, j) => v * slopes[j]));
  const rows = data.observations.map((r) => {
    const fitted = meanY + sum(r.drivers.map((v, j) => (v - means[j]) * slopes[j]));
    return { id: r.id, actual: r.response, fitted, residual: r.response - fitted };
  });
  const orderedRows = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ssResidual = sum(orderedRows.map((r) => r.residual ** 2));
  const ssTotal = sum(y.map((v) => v ** 2));
  if (ssResidual === 0 && rows.some((r) => r.residual !== 0))
    return block('NUMERICAL_RANGE', 'Residual variation is below the supported numerical range.');
  // Nonconstant responses with underflowed spread are not treated as a constant series.
  if (!constant && ssTotal === 0)
    return block('NUMERICAL_RANGE', 'Response variation is below the supported numerical range.');
  const df = n - k - 1;
  const rSquared = constant ? null : 1 - ssResidual / ssTotal;
  const residualStandardError = Math.sqrt(ssResidual / df);
  if (ssResidual > 0 && residualStandardError === 0)
    return block('NUMERICAL_RANGE', 'Residual standard error is below the supported numerical range.');
  if (
    !finite([
      intercept,
      ...slopes,
      ssResidual,
      ssTotal,
      residualStandardError,
      ...(rSquared === null ? [] : [rSquared]),
      ...rows.flatMap((r) => [r.fitted, r.residual]),
    ])
  )
    return block('NUMERICAL_RANGE', 'The fit produced an unrepresentable numerical result.');
  return {
    algorithm,
    compatibility: 'UNVALIDATED',
    status: 'FITTED',
    policy: data.policy,
    responseUnit: data.responseUnit,
    sampleSize: n,
    rank: k + 1,
    residualDegreesOfFreedom: df,
    intercept,
    inference: coefficientInference(
      matrix,
      permutation,
      scales,
      means,
      residualStandardError,
      df,
      n,
      intercept,
      slopes,
      data.drivers.map((d) => d.code),
    ),
    coefficients: data.drivers.map((d, j) => ({
      ...d,
      value: slopes[j],
      observedRange: {
        min: Math.min(...data.observations.map((r) => r.drivers[j])),
        max: Math.max(...data.observations.map((r) => r.drivers[j])),
      },
    })),
    center: { response: meanY, drivers: means },
    rows,
    ssResidual,
    ssTotal,
    rSquared,
    residualStandardError,
    warnings: [
      ...(constant ? ['CONSTANT_RESPONSE' as const] : []),
      ...(rows.some((r) => r.fitted < 0) ? ['NEGATIVE_FITTED_VALUE' as const] : []),
    ],
  };
}
