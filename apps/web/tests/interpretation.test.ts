import { expect, it } from 'vitest';
import { fitRegression } from '../src/domain/analysis/regression';
import { interpretRegression, interpretationPolicy } from '../src/domain/analysis/interpretation';
function fixture() {
  const result = fitRegression({
    responseUnit: 'kWh',
    policy: { version: 'test', relativeRankTolerance: 1e-10 },
    drivers: [{ code: 'X', unit: 'units' }],
    observations: [1, 2, 3, 4].map((x, i) => ({ id: String(i), drivers: [x], response: 10 + x + (i % 2) })),
  });
  if (result.status !== 'FITTED') throw Error(result.message);
  return result;
}
it.each([
  [0.01 - Number.EPSILON, 'Very significant'],
  [0.01, 'Very significant'],
  [0.01 + Number.EPSILON, 'Significant'],
  [0.05 - Number.EPSILON, 'Significant'],
  [0.05, 'Significant'],
  [0.05 + Number.EPSILON, 'Not significant'],
])('classifies raw p=%s with inclusive boundaries', (value, label) => {
  const fit = fixture();
  fit.inference.terms[0].probability = { status: 'OK', value, logValue: Math.log(value) };
  expect(interpretRegression(fit).coefficients[0].label).toBe(label);
});
it.each([
  [0.9 - Number.EPSILON, 'Strong'],
  [0.9, 'Very strong'],
  [0.9 + Number.EPSILON, 'Very strong'],
  [0.8 - Number.EPSILON, 'Acceptable'],
  [0.8, 'Strong'],
  [0.8 + Number.EPSILON, 'Strong'],
  [0.75 - Number.EPSILON, 'Unreliable'],
  [0.75, 'Acceptable'],
  [0.75 + Number.EPSILON, 'Acceptable'],
])('classifies raw R²=%s without display rounding', (rSquared, label) => {
  expect(interpretRegression({ ...fixture(), rSquared }).rSquared.label).toBe(label);
});
it('does not classify undefined or underflow statistics', () => {
  const fit = fixture();
  fit.rSquared = null;
  fit.inference.terms[0].probability = { status: 'UNDERFLOW', value: null, logValue: -900 };
  fit.inference.terms[1].probability = { status: 'ZERO_RESIDUAL_VARIANCE', value: null, logValue: null };
  const saved = interpretRegression(fit);
  expect(saved.rSquared.code).toBe('UNAVAILABLE');
  expect(saved.coefficients.every((t) => t.code === 'UNAVAILABLE')).toBe(true);
  fit.inference = { status: 'NUMERICAL_RANGE', covariance: null, terms: [] };
  expect(interpretRegression(fit).coefficients.every((t) => t.code === 'UNAVAILABLE')).toBe(true);
});
it('snapshots configuration and labels without changing numerical output', () => {
  const fit = fixture(),
    before = structuredClone(fit),
    policy = {
      ...interpretationPolicy,
      pBands: interpretationPolicy.pBands.map((b) => ({ ...b, maximumInclusive: Number(b.maximumInclusive) })),
    };
  const saved = interpretRegression(fit, policy);
  policy.pBands[0].maximumInclusive = 0.02;
  expect(saved.policy.pBands[0].maximumInclusive).toBe(0.01);
  expect(saved.policy.version).toBe('statistical-interpretation-v1');
  expect(fit).toEqual(before);
  const alternate = interpretRegression(fit, {
    ...interpretationPolicy,
    version: 'test-v2',
    rSquaredBands: [{ minimumInclusive: 0, code: 'CUSTOM', label: 'Custom verdict' }],
  });
  expect(alternate.rSquared.label).toBe('Custom verdict');
  expect(saved.rSquared.label).not.toBe('Custom verdict');
});
