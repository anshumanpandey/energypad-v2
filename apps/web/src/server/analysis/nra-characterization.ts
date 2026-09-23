import { z } from 'zod';
import { fitRegression } from '../../domain/analysis/regression';
import { calculateReporting, projectReportingModel } from '../../domain/analysis/reporting';
import { regressionFixtures } from './fixture-readiness';
const evidenceSchema = z.object({
  schemaVersion: z.literal(1),
  extractor: z.literal('nra-source-evidence-v1'),
  approved: z.literal(false),
  nativeRecalculationPerformed: z.literal(false),
  source: z.object({
    sha256: z.literal(regressionFixtures[2].recordedSha256),
    sheet: z.literal('Regression Analysis'),
  }),
  sections: z.record(
    z.string(),
    z.object({
      cells: z.record(
        z.string(),
        z.object({ type: z.string(), storedValue: z.string().nullable(), resolvedValue: z.string().nullable() }),
      ),
    }),
  ),
});
/** Compare the pinned workbook's cached cells, never infer approval or a tolerance. */
export function characterizeNra(input: unknown) {
  const evidence = evidenceSchema.parse(input);
  const cells = Object.assign({}, ...Object.values(evidence.sections).map((s) => s.cells)) as Record<
    string,
    { type: string; storedValue: string | null; resolvedValue: string | null }
  >;
  const number = (address: string) => {
    const cell = cells[address];
    if (
      !cell ||
      cell.type !== 'n' ||
      cell.storedValue === null ||
      cell.storedValue.trim() === '' ||
      !Number.isFinite(Number(cell.storedValue))
    )
      throw Error(`Missing or nonnumeric evidence: ${address}`);
    return Number(cell.storedValue);
  };
  const columns = [...'BCDEFGHIJKLM'];
  const drivers = [
    { code: 'HDD', unit: 'C·day' },
    { code: 'CDD', unit: 'C·day' },
    { code: 'DAYLIGHT', unit: 'hours' },
  ];
  const fit = fitRegression({
    responseUnit: 'kWh',
    policy: { version: 'nra-cache-characterization-v1', relativeRankTolerance: 1e-10 },
    drivers,
    observations: columns.map((c) => ({
      id: `${c}9`,
      response: number(`${c}9`),
      drivers: [6, 7, 8].map((r) => number(`${c}${r}`)),
    })),
  });
  if (fit.status !== 'FITTED') throw Error(`Reference fit blocked: ${fit.reason}`);
  const comparisons: { family: string; cell: string; expected: number; actual: number; absoluteDifference: number }[] =
    [];
  const compare = (family: string, cell: string, actual: number | null) => {
    if (actual === null || !Number.isFinite(actual)) throw Error(`Unavailable result for ${cell}`);
    const expected = number(cell);
    comparisons.push({ family, cell, expected, actual, absoluteDifference: Math.abs(actual - expected) });
  };
  [fit.intercept, ...fit.coefficients.map((c) => c.value)].forEach((v, i) =>
    compare('coefficients', `${'ABCD'[i]}29`, v),
  );
  fit.rows.forEach((r) => {
    compare('fitted', `${r.id[0]}35`, r.fitted);
    compare('residuals', `${r.id[0]}36`, r.residual);
    compare('squaredResiduals', `${r.id[0]}37`, r.residual ** 2);
  });
  compare('ssResidual', 'A41', fit.ssResidual);
  compare('ssTotal', 'D41', fit.ssTotal);
  compare('rSquared', 'G41', fit.rSquared);
  compare('regressionSE', 'A44', fit.residualStandardError);
  if (fit.inference.terms.length !== 4) throw Error('Reference inference unavailable');
  fit.inference.terms.forEach((t, i) => {
    const row = i === 0 ? 52 : 48 + i;
    compare('coefficientSE', `C${row}`, t.standardError);
    compare('tStatistics', `D${row}`, t.tStatistic);
    compare('degreesOfFreedom', `E${row}`, fit.residualDegreesOfFreedom);
    compare('pValues', `F${row}`, t.probability.value);
  });
  // Source labels identify baseline 2022/reporting 2023; scope IDs are harness-only.
  const siteScope = {
    organisationId: '11111111-1111-4111-8111-111111111111',
    siteId: '22222222-2222-4222-8222-222222222222',
  };
  const scope = { ...siteScope, meterId: '33333333-3333-4333-8333-333333333333', energyUseId: null };
  const month = (year: number, i: number) => `${year}-${String(i + 1).padStart(2, '0')}`;
  const observations = (c: string, i: number, baseline: boolean) => [
    {
      id: `${c}${baseline ? 71 : 72}`,
      scope: siteScope,
      month: month(baseline ? 2022 : 2023, i),
      kind: 'OPERATING_HOURS',
      unit: 'hours',
      value: number(`${c}${baseline ? 71 : 72}`),
    },
    {
      id: `${c}${baseline ? 76 : 77}`,
      scope: siteScope,
      month: month(baseline ? 2022 : 2023, i),
      kind: 'POPULATION',
      unit: 'people',
      value: number(`${c}${baseline ? 76 : 77}`),
    },
  ];
  const report = calculateReporting({
    baseline: {
      id: 'nra-reference',
      scope,
      period: { firstMonth: '2022-01', lastMonth: '2022-12' },
      model: projectReportingModel(fit),
      referenceObservations: columns.flatMap((c, i) => observations(c, i, true)),
    },
    period: { firstMonth: '2023-01', lastMonth: '2023-12' },
    policy: {
      version: 'nra-cache-characterization-v1',
      nra: 'HOURS_AND_POPULATION',
      significanceBasis: 'POST_NRA',
      comparison: 'AT_LEAST',
      sigmaMultiplier: 2,
      zeroThreshold: 'UNDEFINED',
      negativePrediction: 'ALLOW_WITH_WARNING',
      extrapolation: 'ALLOW_WITH_WARNING',
    },
    rows: columns.map((c, i) => ({
      consumption: { id: `${c}61`, scope, month: month(2023, i), kwh: number(`${c}61`) },
      drivers: drivers.map((d, j) => ({
        ...d,
        id: `${c}${58 + j}`,
        scope: siteScope,
        month: month(2023, i),
        value: number(`${c}${58 + j}`),
      })),
      nraReferenceMonth: month(2022, i),
      nraObservations: observations(c, i, false),
    })),
  });
  if (report.status !== 'CALCULATED') throw Error('Reference reporting blocked');
  const classifications: { cell: string; expected: string; actual: string; matches: boolean }[] = [];
  report.rows.forEach((r, i) => {
    if (r.status !== 'CALCULATED') throw Error('Incomplete reference row');
    const c = columns[i];
    for (const [family, row, value] of [
      ['expected', 63, r.expectedKwh],
      ['preNraVariance', 65, r.preNraVarianceKwh],
      ['nraFactor', 81, r.nraMultiplier],
      ['adjustedExpected', 82, r.adjustedExpectedKwh],
      ['postNraVariance', 84, r.postNraVarianceKwh],
      ['significanceThreshold', 91, r.significance.thresholdKwh],
    ] as const)
      compare(family, `${c}${row}`, value);
    const expected = cells[`${c}95`]?.resolvedValue;
    if (expected !== 'YES' && expected !== 'NO') throw Error('Missing significance cache');
    if (r.significance.significant === null) throw Error('Reference significance unavailable');
    const actual = r.significance.significant ? 'YES' : 'NO';
    classifications.push({ cell: `${c}95`, expected, actual, matches: expected === actual });
  });
  const families = [...new Set(comparisons.map((c) => c.family))].map((family) => ({
    family,
    count: comparisons.filter((c) => c.family === family).length,
    maximumAbsoluteDifference: Math.max(
      ...comparisons.filter((c) => c.family === family).map((c) => c.absoluteDifference),
    ),
  }));
  return {
    kind: 'CACHE_CHARACTERIZATION',
    approved: false,
    readyForCompatibilityAcceptance: false,
    nativeRecalculationPerformed: false,
    source: evidence.source,
    algorithm: fit.algorithm,
    reportingAlgorithm: report.algorithm,
    tolerancePolicy: null,
    assumptions:
      'Baseline 2022, reporting 2023; source driver order HDD/CDD/daylight; monthly reference joins. Units and methodology still require review.',
    families,
    comparisons,
    classifications,
  };
}
