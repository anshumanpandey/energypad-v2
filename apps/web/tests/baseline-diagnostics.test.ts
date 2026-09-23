import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { interpretRegression } from '../src/domain/analysis/interpretation';
import { BaselineDiagnostics } from '../src/components/baseline-diagnostics';
import { fitRegression } from '../src/domain/analysis/regression';
function fixture() {
  const fit = fitRegression({
    responseUnit: 'kWh',
    policy: { version: 'test', relativeRankTolerance: 1e-10 },
    drivers: [{ code: 'POPULATION', unit: 'people' }],
    observations: [1, 2, 3, 4].map((x, i) => ({ id: `source-${i}`, drivers: [x], response: 100 + 2 * x + (i % 2) })),
  });
  if (fit.status !== 'FITTED') throw new Error(fit.message);
  return fit;
}
const observations = [3, 1, 0, 2].map((i) => ({ consumption: { id: `source-${i}`, month: `2020-0${i + 1}` } }));
it('joins residual months by source revision and preserves small probabilities', () => {
  const fit = fixture();
  fit.inference.terms[0].probability = { status: 'OK', value: 1e-18, logValue: Math.log(1e-18) };
  const html = renderToStaticMarkup(createElement(BaselineDiagnostics, { fit, observations }));
  expect(html).toContain('1.00000e-18');
  const rows = html.match(/<tr>.*?<\/tr>/g) ?? [];
  for (let i = 0; i < 4; i++) {
    expect(rows.find((row) => row.includes(`source-${i}`))).toContain(`2020-0${i + 1}</th>`);
  }
  expect(html).toContain('kWh / people');
});
it('explains undefined and underflow probabilities without representing them as zero', () => {
  const fit = fixture();
  fit.inference.terms[0].tStatistic = null;
  fit.inference.terms[0].probability = { status: 'ZERO_RESIDUAL_VARIANCE', value: null, logValue: null };
  fit.inference.terms[1].probability = { status: 'UNDERFLOW', value: null, logValue: -900 };
  const html = renderToStaticMarkup(createElement(BaselineDiagnostics, { fit, observations }));
  expect(html).toContain('Undefined: zero residual variance');
  expect(html).toContain('Below numeric range; ln(p) =');
  expect(html).toContain('-900');
});
it('keeps estimates and residuals available when inference exceeds numeric range', () => {
  const fit = fixture();
  fit.inference = { status: 'NUMERICAL_RANGE', covariance: null, terms: [] };
  const html = renderToStaticMarkup(createElement(BaselineDiagnostics, { fit, observations: [] }));
  expect(html).toContain(`title="${fit.intercept}"`);
  expect(html).toContain('Unavailable: numeric range exceeded');
  expect(html).toContain('Month unavailable');
  expect(html).toContain('source-0');
});

it('shows persisted verdicts and leaves older baselines unlabelled', () => {
  const fit = fixture();
  const interpretation = interpretRegression(fit);
  interpretation.rSquared.label = 'Frozen historical verdict';
  const html = renderToStaticMarkup(createElement(BaselineDiagnostics, { fit, observations, interpretation }));
  expect(html).toContain('Frozen historical verdict');
  expect(html).toContain('statistical-interpretation-v1');
  const legacy = renderToStaticMarkup(createElement(BaselineDiagnostics, { fit, observations }));
  expect(legacy).toContain('No interpretation policy was saved');
  expect(legacy).not.toContain('Frozen historical verdict');
});
