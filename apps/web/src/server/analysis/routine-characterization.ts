import { z } from 'zod';
import { fitRegression } from '../../domain/analysis/regression';
import { calculateReporting, projectReportingModel } from '../../domain/analysis/reporting';
import { regressionFixtures } from './fixture-readiness';
const evidenceSchema = z.object({
  schemaVersion: z.literal(1),
  extractor: z.literal('routine-source-evidence-v1'),
  approved: z.literal(false),
  nativeRecalculationPerformed: z.literal(false),
  source: z.object({
    sha256: z.enum([regressionFixtures[0].recordedSha256, regressionFixtures[1].recordedSha256]),
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
export function characterizeRoutine(input: unknown) {
  const evidence = evidenceSchema.parse(input);
  const single = evidence.source.sha256 === regressionFixtures[0].recordedSha256;
  const layout = single
    ? {
        response: 7,
        fit: 23,
        stats: 29,
        se: 32,
        reportDriver: 46,
        actual: 47,
        expected: 49,
        variance: 51,
        threshold: 58,
        flag: 62,
      }
    : {
        response: 8,
        fit: 27,
        stats: 33,
        se: 36,
        reportDriver: 49,
        actual: 51,
        expected: 53,
        variance: 55,
        threshold: 62,
        flag: 66,
      };
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
  ].slice(0, single ? 1 : 2);
  const fit = fitRegression({
    responseUnit: 'kWh',
    policy: { version: 'routine-cache-characterization-v1', relativeRankTolerance: 1e-10 },
    drivers,
    observations: columns.map((c) => ({
      id: `${c}${layout.response}`,
      response: number(`${c}${layout.response}`),
      drivers: drivers.map((_, i) => number(`${c}${6 + i}`)),
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
    compare('coefficients', (single ? ['L17', 'J17'] : ['J21', 'K21', 'L21'])[i], v),
  );
  fit.rows.forEach((r) => {
    compare('fitted', `${r.id[0]}${layout.fit}`, r.fitted);
    compare('residuals', `${r.id[0]}${layout.fit + 1}`, r.residual);
    compare('squaredResiduals', `${r.id[0]}${layout.fit + 2}`, r.residual ** 2);
  });
  compare('ssResidual', `A${layout.stats}`, fit.ssResidual);
  compare('ssTotal', `D${layout.stats}`, fit.ssTotal);
  compare('rSquared', `G${layout.stats}`, fit.rSquared);
  compare('regressionSE', `A${layout.se}`, fit.residualStandardError);
  if (fit.inference.terms.length !== drivers.length + 1) throw Error('Reference inference unavailable');
  fit.inference.terms.forEach((t, i) => {
    // Single reference only supplies slope inference, not intercept inference.
    if (single && i === 0) return;
    const row = i === 0 ? 43 : 40 + i;
    compare('coefficientSE', single ? 'C39' : `C${row}`, t.standardError);
    compare('tStatistics', single ? 'E39' : `D${row}`, t.tStatistic);
    compare('degreesOfFreedom', single ? 'G39' : `E${row}`, fit.residualDegreesOfFreedom);
    compare('pValues', single ? 'I39' : `F${row}`, t.probability.value);
  });
  // Source labels identify baseline 2022/reporting 2023; scope IDs are harness-only.
  const siteScope = {
    organisationId: '11111111-1111-4111-8111-111111111111',
    siteId: '22222222-2222-4222-8222-222222222222',
  };
  const scope = { ...siteScope, meterId: '33333333-3333-4333-8333-333333333333', energyUseId: null };
  const month = (year: number, i: number) => `${year}-${String(i + 1).padStart(2, '0')}`;
  const report = calculateReporting({
    baseline: {
      id: 'routine-reference',
      scope,
      period: { firstMonth: '2022-01', lastMonth: '2022-12' },
      model: projectReportingModel(fit),
      referenceObservations: [],
    },
    period: { firstMonth: '2023-01', lastMonth: '2023-12' },
    policy: {
      version: 'routine-cache-characterization-v1',
      nra: 'NONE',
      significanceBasis: 'POST_NRA',
      comparison: 'AT_LEAST',
      sigmaMultiplier: 2,
      zeroThreshold: 'UNDEFINED',
      negativePrediction: 'ALLOW_WITH_WARNING',
      extrapolation: 'ALLOW_WITH_WARNING',
    },
    rows: columns.map((c, i) => ({
      consumption: { id: `${c}${layout.actual}`, scope, month: month(2023, i), kwh: number(`${c}${layout.actual}`) },
      drivers: drivers.map((d, j) => ({
        ...d,
        id: `${c}${layout.reportDriver + j}`,
        scope: siteScope,
        month: month(2023, i),
        value: number(`${c}${layout.reportDriver + j}`),
      })),
      nraReferenceMonth: null,
      nraObservations: [],
    })),
  });
  if (report.status !== 'CALCULATED') throw Error('Reference reporting blocked');
  const classifications: { cell: string; expected: string; actual: string; matches: boolean }[] = [];
  report.rows.forEach((r, i) => {
    if (r.status !== 'CALCULATED') throw Error('Incomplete reference row');
    const c = columns[i];
    for (const [family, row, value] of [
      ['expected', layout.expected, r.expectedKwh],
      ['variance', layout.variance, r.preNraVarianceKwh],
      ['significanceThreshold', layout.threshold, r.significance.thresholdKwh],
    ] as const)
      compare(family, `${c}${row}`, value);
    const expected = cells[`${c}${layout.flag}`]?.resolvedValue;
    if (expected !== 'YES' && expected !== 'NO') throw Error('Missing significance cache');
    if (r.significance.significant === null) throw Error('Reference significance unavailable');
    const actual = r.significance.significant ? 'YES' : 'NO';
    classifications.push({ cell: `${c}${layout.flag}`, expected, actual, matches: expected === actual });
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
      'Baseline 2022, reporting 2023; source driver order HDD then CDD when present; no NRA. Units and methodology still require review.',
    coverageGaps: single ? ['Workbook has no intercept SE/t/p reference.'] : [],
    families,
    comparisons,
    classifications,
  };
}
