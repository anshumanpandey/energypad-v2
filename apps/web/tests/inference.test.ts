import { expect, it } from 'vitest';
import reference from './fixtures/inference-reference.json';
import rational from './fixtures/regression-rational.json';
import { studentTTwoSided } from '../src/domain/analysis/student-t';
import { fitRegression, type RegressionInput } from '../src/domain/analysis/regression';
const input: RegressionInput = {
  responseUnit: 'kWh',
  policy: { version: 'synthetic-inference-v1', relativeRankTolerance: 1e-10 },
  drivers: [1, 2, 3].map((n) => ({ code: `X${n}`, unit: 'synthetic' })),
  observations: rational.x.map((drivers, i) => ({ id: String(i), drivers, response: rational.y[i] })),
};
function infer(data = input) {
  const fit = fitRegression(data);
  expect(fit.status).toBe('FITTED');
  if (fit.status !== 'FITTED') throw new Error(fit.message);
  expect(fit.inference.status).not.toBe('NUMERICAL_RANGE');
  if (fit.inference.status === 'NUMERICAL_RANGE') throw new Error('Inference unavailable');
  return fit.inference;
}
it('matches independent exact-rational covariance and quadrature-based probabilities', () => {
  const result = infer();
  expect(result.status).toBe('AVAILABLE');
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      expect(result.covariance[i][j]).toBeCloseTo(reference.covariance[i][j], 11);
      expect(result.covariance[i][j]).toBe(result.covariance[j][i]);
    }
    expect(result.terms[i].standardError).toBeCloseTo(reference.standardErrors[i], 11);
    expect(result.terms[i].tStatistic).toBeCloseTo(reference.tStatistics[i], 11);
    expect(result.terms[i].probability.status).toBe('OK');
    expect(result.terms[i].probability.value! / reference.pValues[i]).toBeCloseTo(1, 10);
  }
});
it('preserves coefficient identity, covariance and probabilities under driver permutation and row reordering', () => {
  const original = infer();
  const indexes = [2, 0, 1];
  const permuted = infer({
    ...input,
    drivers: indexes.map((i) => input.drivers[i]),
    observations: [...input.observations].reverse().map((r) => ({ ...r, drivers: indexes.map((i) => r.drivers[i]) })),
  });
  const all = [0, 3, 1, 2];
  permuted.terms.forEach((term, i) => {
    expect(term.driverCode).toBe(original.terms[all[i]].driverCode);
    expect(term.standardError).toBeCloseTo(original.terms[all[i]].standardError, 11);
    expect(term.probability.value).toBeCloseTo(original.terms[all[i]].probability.value!, 12);
    permuted.covariance[i].forEach((v, j) => expect(v).toBeCloseTo(original.covariance[all[i]][all[j]], 11));
  });
});
it('keeps t/p invariant to driver-unit scaling and estimates intercept uncertainty with nonzero means', () => {
  const original = infer();
  const scaled = infer({
    ...input,
    observations: input.observations.map((r) => ({ ...r, drivers: r.drivers.map((v, j) => v * [1e-6, 1e6, -3][j]) })),
  });
  scaled.terms.forEach((term, i) => {
    expect(Math.abs(term.tStatistic!)).toBeCloseTo(Math.abs(original.terms[i].tStatistic!), 10);
    expect(term.probability.value).toBeCloseTo(original.terms[i].probability.value!, 11);
  });
  expect(scaled.terms[0].standardError).toBeCloseTo(original.terms[0].standardError, 11);
});
it('returns zero errors and null t/p for zero residual variance, without NaN/Infinity', () => {
  const result = infer({ ...input, observations: input.observations.map((r) => ({ ...r, response: 0 })) });
  expect(result.status).toBe('ZERO_RESIDUAL_VARIANCE');
  result.terms.forEach((term) => {
    expect(term.standardError).toBe(0);
    expect(term.tStatistic).toBeNull();
    expect(term.probability).toEqual({ status: 'ZERO_RESIDUAL_VARIANCE', value: null, logValue: null });
  });
  expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
});
it.each(reference.studentT)('matches independent t-density integration at df=$df, t=$t', ({ df, t, p }) => {
  const result = studentTTwoSided(t, df);
  expect(result.status).toBe('OK');
  expect(result.value! / p).toBeCloseTo(1, 9);
  expect(studentTTwoSided(-t, df)).toEqual(result);
});
it('matches exact Cauchy tails and the published SciPy df=3, t=1 example', () => {
  expect(studentTTwoSided(1, 1)).toMatchObject({ status: 'OK', value: 0.5 });
  expect(studentTTwoSided(1, 3).value).toBeCloseTo(2 * (1 - 0.8044988905221148), 13);
  expect(studentTTwoSided(1, 2).value).toBeCloseTo(1 - 1 / Math.sqrt(3), 13);
  expect(studentTTwoSided(1e308, 1).value).toBeGreaterThan(0);
});
it('distinguishes unrepresentable tails from exactly zero and rejects unsupported df/nonfinite t', () => {
  const tiny = studentTTwoSided(1e200, 8);
  expect(tiny.status).toBe('UNDERFLOW');
  expect(tiny.value).toBeNull();
  expect(tiny.logValue).toBeLessThan(-3000);
  for (const df of [0, -1, 1.5, 2399, Infinity]) expect(studentTTwoSided(1, df).status).toBe('INVALID_INPUT');
  for (const t of [Infinity, -Infinity, NaN]) expect(studentTTwoSided(t, 8).status).toBe('INVALID_INPUT');
});

it('matches the analytic one-driver covariance including the intercept/slope cross term', () => {
  const x = [-2, -1, 0, 1, 2],
    noise = [1, -2, 2, -2, 1];
  const result = infer({
    ...input,
    drivers: [input.drivers[0]],
    observations: x.map((v, i) => ({ id: String(i), drivers: [v + 7], response: 10 + 3 * v + noise[i] })),
  });
  const variance = 14 / 3;
  expect(result.covariance[0][0]).toBeCloseTo(variance * (1 / 5 + 49 / 10), 11);
  expect(result.covariance[0][1]).toBeCloseTo((-variance * 7) / 10, 11);
  expect(result.covariance[1][1]).toBeCloseTo(variance / 10, 11);
});
it('preserves the fit while marking covariance overflow unavailable', () => {
  const result = fitRegression({
    ...input,
    observations: input.observations.map((r) => ({ ...r, drivers: [r.drivers[0] * 1e-200, ...r.drivers.slice(1)] })),
  });
  expect(result.status).toBe('FITTED');
  if (result.status !== 'FITTED') throw new Error(result.message);
  expect(result.inference).toEqual({ status: 'NUMERICAL_RANGE', covariance: null, terms: [] });
  expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
});
