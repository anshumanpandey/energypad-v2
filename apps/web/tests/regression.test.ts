import rational from './fixtures/regression-rational.json';
import { describe, expect, it } from 'vitest';
import { fitRegression, type RegressionInput, type RegressionResult } from '../src/domain/analysis/regression';
const policy = { version: 'synthetic-test-policy-v1', relativeRankTolerance: 1e-10 };
const make = (xs: number[][], ys: number[]): RegressionInput => ({
  responseUnit: 'kWh',
  policy,
  drivers: xs[0].map((_, j) => ({ code: `X${j + 1}`, unit: 'synthetic units' })),
  observations: xs.map((drivers, i) => ({ id: `row-${i}`, drivers, response: ys[i] })),
});
function fitted(result: RegressionResult) {
  expect(result.status).toBe('FITTED');
  if (result.status !== 'FITTED') throw new Error(result.message);
  return result;
}
function blocked(input: unknown, reason: string) {
  expect(fitRegression(input)).toMatchObject({ status: 'BLOCKED', reason, compatibility: 'UNVALIDATED' });
}
const factorial = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
describe('experimental QR regression', () => {
  it('matches a nonorthogonal noisy reference solved independently with exact rational arithmetic', () => {
    const result = fitted(fitRegression(make(rational.x, rational.y)));
    [result.intercept, ...result.coefficients.map((c) => c.value)].forEach((v, i) =>
      expect(v).toBeCloseTo(rational.coefficients[i], 11),
    );
    result.rows.forEach((r, i) => expect(r.fitted).toBeCloseTo(rational.fitted[i], 11));
    expect(result.ssResidual).toBeCloseTo(rational.ssResidual, 11);
    expect(result.ssTotal).toBeCloseTo(rational.ssTotal, 11);
    expect(result.rSquared).toBeCloseTo(rational.rSquared, 12);
    expect(result.residualDegreesOfFreedom).toBe(rational.residualDegreesOfFreedom);
  });

  it('matches an independent one-driver construction with noise orthogonal to intercept and x', () => {
    const x = [-2, -1, 0, 1, 2],
      noise = [1, -2, 2, -2, 1];
    const result = fitted(
      fitRegression(
        make(
          x.map((v) => [v]),
          x.map((v, i) => 10 + 3 * v + noise[i]),
        ),
      ),
    );
    expect(result.intercept).toBeCloseTo(10, 12);
    expect(result.coefficients[0].value).toBeCloseTo(3, 12);
    expect(result.ssResidual).toBeCloseTo(14, 12);
    expect(result.ssTotal).toBeCloseTo(104, 12);
    expect(result.rSquared).toBeCloseTo(1 - 14 / 104, 12);
    expect(result.residualDegreesOfFreedom).toBe(3);
    expect(result.residualStandardError).toBeCloseTo(Math.sqrt(14 / 3), 12);
    result.rows.forEach((r, i) => expect(r.residual).toBeCloseTo(noise[i], 12));
    expect(result.compatibility).toBe('UNVALIDATED');
  });
  it.each([2, 3])('recovers %i slopes and unrounded statistics from orthogonal factorial data', (k) => {
    const xs = factorial.map((r) => r.slice(0, k));
    const slopes = [2, -3, 4].slice(0, k);
    const noise = factorial.map((r) => 0.5 * r[0] * r[1] * r[2]);
    const ys = xs.map((r, i) => 10 + r.reduce((n, v, j) => n + slopes[j] * v, 0) + noise[i]);
    const result = fitted(fitRegression(make(xs, ys)));
    expect(result.intercept).toBeCloseTo(10, 12);
    result.coefficients.forEach((c, j) => expect(c.value).toBeCloseTo(slopes[j], 12));
    expect(result.rank).toBe(k + 1);
    expect(result.ssResidual).toBeCloseTo(2, 12);
    expect(result.ssTotal).toBeCloseTo(8 * slopes.reduce((s, v) => s + v * v, 0) + 2, 11);
    expect(result.residualDegreesOfFreedom).toBe(8 - k - 1);
  });
  it('keeps driver identity across column pivoting and is deterministic for shuffled rows', () => {
    const input = make(
      factorial.map((r) => [r[0] + 0.2 * r[1], r[1], r[2]]),
      factorial.map((r) => 10 + 2 * (r[0] + 0.2 * r[1]) - 3 * r[1] + 4 * r[2]),
    );
    const original = structuredClone(input);
    const result = fitted(fitRegression(input));
    const reordered = fitted(fitRegression({ ...input, observations: [...input.observations].reverse() }));
    expect(reordered.coefficients).toEqual(result.coefficients);
    expect(reordered.ssResidual).toBe(result.ssResidual);
    expect(reordered.rows.map((r) => r.id)).toEqual(input.observations.map((r) => r.id).reverse());
    const permuted = fitted(
      fitRegression({
        ...input,
        drivers: [input.drivers[2], input.drivers[0], input.drivers[1]],
        observations: input.observations.map((r) => ({ ...r, drivers: [r.drivers[2], r.drivers[0], r.drivers[1]] })),
      }),
    );
    for (const coefficient of result.coefficients)
      expect(permuted.coefficients.find((c) => c.code === coefficient.code)!.value).toBeCloseTo(coefficient.value, 12);
    expect(input).toEqual(original);
  });
  it('handles offsets and differently scaled predictors without normal equations', () => {
    const input = make(
      factorial.map((r) => [1e9 + r[0] * 1e-3, r[1] * 1e6, r[2] * 1e-6]),
      [],
    );
    input.observations.forEach((r) => {
      r.response = 50 + 2 * (r.drivers[0] - 1e9) - 3e-6 * r.drivers[1] + 4e6 * r.drivers[2];
    });
    const result = fitted(fitRegression(input));
    expect(result.coefficients[0].value).toBeCloseTo(2, 7);
    expect(result.coefficients[1].value).toBeCloseTo(-3e-6, 12);
    expect(result.coefficients[2].value / 4e6).toBeCloseTo(1, 12);
    result.rows.forEach((r) => expect(r.fitted).toBeCloseTo(r.actual, 11));
  });
  it('preserves zero responses and returns null R² for constant responses', () => {
    const result = fitted(fitRegression(make([[0], [1], [2], [3]], [0, 0, 0, 0])));
    expect(result.intercept).toBe(0);
    expect(result.ssResidual).toBe(0);
    expect(result.residualStandardError).toBe(0);
    expect(result.rSquared).toBeNull();
    expect(result.warnings).toContain('CONSTANT_RESPONSE');
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });
  it('does not clip negative fitted values or round residuals into exact compatibility', () => {
    const result = fitted(fitRegression(make([[0], [1], [2], [3]], [0, 0, 0, 10])));
    expect(result.rows[0].fitted).toBeCloseTo(-2, 12);
    expect(result.warnings).toContain('NEGATIVE_FITTED_VALUE');
  });
  it('rejects duplicate IDs, shape mismatch, missing/nonfinite values and insufficient df', () => {
    const input = make([[0], [1], [2], [3]], [1, 2, 3, 4]);
    blocked({ ...input, policy: undefined }, 'INVALID_INPUT');
    blocked({ ...input, observations: input.observations.map((r) => ({ ...r, id: 'same' })) }, 'DUPLICATE_ID');
    blocked({ ...input, observations: input.observations.map((r) => ({ ...r, drivers: [1, 2] })) }, 'DRIVER_SHAPE');
    for (const response of [null, undefined, Infinity, NaN])
      blocked(
        { ...input, observations: [{ ...input.observations[0], response }, ...input.observations.slice(1)] },
        'INVALID_INPUT',
      );
    blocked(make([[0], [1]], [1, 2]), 'INSUFFICIENT_OBSERVATIONS');
  });
  it('rejects constant, exactly collinear and nearly collinear drivers according to explicit rank policy', () => {
    blocked(make([[5], [5], [5], [5]], [1, 2, 3, 4]), 'RANK_DEFICIENT');
    const input = make(
      [
        [0, 0],
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
      ],
      [1, 2, 4, 8, 16],
    );
    blocked(input, 'RANK_DEFICIENT');
    input.observations[2].drivers[1] += 1e-12;
    blocked(input, 'RANK_DEFICIENT');
    blocked({ ...input, policy: { ...policy, relativeRankTolerance: 0 } }, 'INVALID_INPUT');
  });
  it('reports overflow and underflow instead of returning misleading zero or nonfinite results', () => {
    blocked(make([[-2], [-1], [0], [1], [2]], [-1e308, -5e307, 0, 5e307, 1e308]), 'NUMERICAL_RANGE');
    blocked(make([[0], [1], [2], [3]], [0, 1e-200, 2e-200, 3e-200]), 'NUMERICAL_RANGE');
    blocked(make([[0], [1], [2], [3]], [1e-168, 1e-154, 2e-154, 3e-154]), 'NUMERICAL_RANGE');
  });
});
