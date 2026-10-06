import { expect, it } from 'vitest';
import { fitRegression } from '../src/domain/analysis/regression';
import { calculateReporting, projectReportingModel, type ReportingInput } from '../src/domain/analysis/reporting';
import { calculationFilename } from '../src/domain/analysis/calculation-download';
import ExcelJS from 'exceljs';
import { calculationWorkbook } from '../src/server/analysis/calculation-workbook';

it('matches the supplied single-routine coefficients and all reporting calculations', async () => {
  const hdd = [350.2, 285, 232.7, 126.6, 59.5, 9.5, 0, 0, 41.1, 102, 184.5, 242.2];
  const consumption = [45, 44, 50, 43, 45, 44, 40, 43, 39, 40, 45, 40];
  const reportingHdd = [2008.2, 1870.9, 1991.9, 1785, 1726, 1532.2, 1405, 1457.1, 1455.6, 1668.7, 1892, 1989.8];
  const actual = [190, 210, 220, 190, 370, 290, 280, 350, 290, 210, 280, 200];
  const fit = fitRegression({
    responseUnit: 'kWh',
    policy: { version: 'reference', relativeRankTolerance: 1e-10 },
    drivers: [{ code: 'HDD', unit: 'C·day' }],
    observations: hdd.map((value, i) => ({ id: `input-${i}`, drivers: [value], response: consumption[i] })),
  });
  if (fit.status !== 'FITTED') throw new Error(fit.message);
  expect(fit.coefficients[0].value).toBeCloseTo(0.010255829163599914, 12);
  expect(fit.intercept).toBeCloseTo(41.77076285225769, 12);
  expect(fit.rSquared).toBeCloseTo(0.15942637905655932, 12);
  expect(fit.residualStandardError).toBeCloseTo(2.9802787220832814, 12);
  expect(fit.inference.terms.find((term) => term.driverCode === 'HDD')!.probability.value).toBeCloseTo(
    0.19849783313133354,
    12,
  );
  const scope = {
    organisationId: '11111111-1111-4111-8111-111111111111',
    siteId: '22222222-2222-4222-8222-222222222222',
    meterId: '33333333-3333-4333-8333-333333333333',
    energyUseId: null,
  };
  const input: ReportingInput = {
    baseline: {
      id: 'reference',
      scope,
      period: { firstMonth: '2025-01', lastMonth: '2025-12' },
      model: projectReportingModel(fit)!,
      referenceObservations: [],
    },
    period: { firstMonth: '2026-01', lastMonth: '2026-12' },
    policy: {
      version: 'reference',
      nra: 'NONE',
      significanceBasis: 'POST_NRA',
      comparison: 'AT_LEAST',
      sigmaMultiplier: 2,
      zeroThreshold: 'UNDEFINED',
      negativePrediction: 'BLOCK',
      extrapolation: 'ALLOW_WITH_WARNING',
    },
    rows: reportingHdd.map((value, i) => {
      const month = `2026-${String(i + 1).padStart(2, '0')}`;
      return {
        consumption: { id: `report-${i}`, scope, month, kwh: actual[i] },
        drivers: [
          {
            id: `hdd-${i}`,
            scope: { organisationId: scope.organisationId, siteId: scope.siteId },
            month,
            code: 'HDD',
            unit: 'C·day',
            value,
          },
        ],
        nraReferenceMonth: null,
        nraObservations: [],
      };
    }),
  };
  const result = calculateReporting(input);
  expect(result.status, JSON.stringify(result)).toBe('CALCULATED');
  result.rows.forEach((row, i) => {
    if (row.status !== 'CALCULATED') throw new Error(JSON.stringify(row));
    const expected = 0.010255829163599914 * reportingHdd[i] + 41.77076285225769;
    expect(row.expectedKwh).toBeCloseTo(expected, 10);
    expect(row.postNraVarianceKwh).toBeCloseTo(expected - actual[i], 10);
    expect(row.significance.thresholdKwh).toBeCloseTo(5.960557444166563, 10);
    expect(row.significance.significant).toBe(true);
  });
  const run = {
    id: 'reference',
    inputHash: 'reference-inputs',
    createdAt: new Date('2026-10-06T00:00:00Z'),
    generated: true,
    baseline: {
      id: 'reference',
      fit,
      snapshot: {
        definition: { period: input.baseline.period },
        assembly: {
          rows: hdd.map((value, i) => ({
            consumption: { id: `input-${i}`, month: `2025-${String(i + 1).padStart(2, '0')}`, kwh: consumption[i] },
            drivers: [{ code: 'HDD', value }],
          })),
        },
      },
    },
    result: { output: result },
  } as unknown as Parameters<typeof calculationWorkbook>[0];
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    (await calculationWorkbook(run, 'Reference site')) as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  const sheet = book.getWorksheet('Regression Analysis')!;
  const rows = new Map<string, number>();
  sheet.eachRow((row, i) => rows.set(String(row.getCell(1).value), i));
  const cell = (label: string, column: number) => sheet.getCell(rows.get(label)!, column);
  expect(cell('SS_res = Sum of residual²', 2).result).toBeCloseTo(88.82061261302356, 10);
  expect(cell('SS_tot = Sum of (Actual − Mean)²', 2).result).toBeCloseTo(105.66666666666666, 10);
  expect(cell('Slope p value (two-tailed)', 2).result).toBeCloseTo(0.19849783313133354, 12);
  for (let i = 0; i < 12; i++) {
    const expected = 0.010255829163599914 * reportingHdd[i] + 41.77076285225769;
    expect(cell('Expected consumption (kWh)', i + 2).result).toBeCloseTo(expected, 10);
    expect(cell('Savings (+) / Waste (−) after NRA', i + 2).result).toBeCloseTo(expected - actual[i], 10);
    expect(cell('Significant?', i + 2).formula).toContain('>=');
    expect(cell('Significant?', i + 2).result).toBe(true);
  }
});

it('names calculation downloads with safe organisation, site, year and method parts', () => {
  expect(calculationFilename('Acme Energy', 'London Office', 2025, 'Single Routine Adjustment')).toBe(
    'acme-energy-london-office-2025-single-routine-adjustment.xlsx',
  );
  expect(calculationFilename('Acme', 'London', 2026, 'Multiple Routine Adjustment + NRA')).toBe(
    'acme-london-2026-multiple-routine-adjustment-nra.xlsx',
  );
  expect(calculationFilename('"\r\n.. / Acme', 'London / Office', 2025, 'Single Routine Adjustment')).toBe(
    'acme-london-office-2025-single-routine-adjustment.xlsx',
  );
});
