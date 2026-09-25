import { regressionFixtures } from './fixture-readiness';
import { compatibilityPolicy } from './compatibility-policy';

const monthly = (row: number) => [...'BCDEFGHIJKLM'].map((column) => `${column}${row}`);
function layout(id: (typeof regressionFixtures)[number]['id']) {
  const single = id === 'single',
    nra = id === 'multi-nra';
  const fit = nra ? 35 : single ? 23 : 27;
  const stats = nra ? 41 : single ? 29 : 33;
  const families: Record<string, string[]> = {
    coefficients: nra ? ['A29', 'B29', 'C29', 'D29'] : single ? ['L17', 'J17'] : ['J21', 'K21', 'L21'],
    fitted: monthly(fit),
    residuals: monthly(fit + 1),
    squaredResiduals: monthly(fit + 2),
    ssResidual: [`A${stats}`],
    ssTotal: [`D${stats}`],
    rSquared: [`G${stats}`],
    regressionSE: [nra ? 'A44' : single ? 'A32' : 'A36'],
    coefficientSE: single ? ['C39'] : (nra ? [49, 50, 51, 52] : [41, 42, 43]).map((r) => `C${r}`),
    tStatistics: single ? ['E39'] : (nra ? [49, 50, 51, 52] : [41, 42, 43]).map((r) => `D${r}`),
    degreesOfFreedom: single ? ['G39'] : (nra ? [49, 50, 51, 52] : [41, 42, 43]).map((r) => `E${r}`),
    pValues: single ? ['I39'] : (nra ? [49, 50, 51, 52] : [41, 42, 43]).map((r) => `F${r}`),
    expected: monthly(nra ? 63 : single ? 49 : 53),
    significanceThreshold: monthly(nra ? 91 : single ? 58 : 62),
  };
  if (nra)
    Object.assign(families, {
      preNraVariance: monthly(65),
      nraFactor: monthly(81),
      adjustedExpected: monthly(82),
      postNraVariance: monthly(84),
    });
  else families.variance = monthly(single ? 51 : 55);
  return {
    numerical: Object.entries(families).flatMap(([family, cells]) => cells.map((cell) => ({ family, cell }))),
    classifications: monthly(nra ? 95 : single ? 62 : 66),
  };
}

// Address contracts are independent of the extractor's emitted comparisons.
// Source workbook bytes remain private and are verified on every execution.
export const workbookRegistry = {
  version: 'workbook-cell-coverage-v1',
  policyVersion: compatibilityPolicy.version,
  algorithm: 'ols-qr-experimental-v3',
  reportingAlgorithm: 'energy-reporting-experimental-v1',
  fixtures: regressionFixtures.map((fixture) => ({ ...fixture, sheet: 'Regression Analysis', ...layout(fixture.id) })),
} as const;
