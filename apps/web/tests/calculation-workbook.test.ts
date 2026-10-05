import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { calculationWorkbook } from '../src/server/analysis/calculation-workbook';
import { fitRegression } from '../src/domain/analysis/regression';
import { calculateReporting, projectReportingModel, type ReportingInput } from '../src/domain/analysis/reporting';
import type { AnalysisService } from '../src/server/analysis/service';
import { classificationMethod } from '../src/domain/analysis/classification-method';

it('chooses single, multiple and NRA methods without substituting unrelated NR drivers', () => {
  const values = {
    heating: 'R',
    cooling: 'N/A',
    population: 'N/A',
    operatingHours: 'N/A',
    daylighting: 'N/A',
    buildingSize: 'N/A',
  };
  expect(classificationMethod(values)).toMatchObject({
    name: 'Single routine adjustment',
    nra: 'NONE',
    defaultDrivers: ['HDD'],
  });
  expect(classificationMethod({ ...values, cooling: 'R' })).toMatchObject({
    name: 'Multiple routine adjustment',
    defaultDrivers: ['HDD', 'CDD'],
  });
  expect(classificationMethod({ ...values, population: 'NR' })).toMatchObject({
    name: 'Multiple routine adjustment + NRA',
    nra: 'POPULATION',
  });
  expect(classificationMethod({ ...values, population: 'NR', operatingHours: 'NR' }).nra).toBe('HOURS_AND_POPULATION');
  expect(classificationMethod({ ...values, daylighting: 'NR' })).toMatchObject({
    nra: 'NONE',
    unsupportedNra: ['daylighting'],
  });
});

it.each([1, 2, 3])(
  'exports %i-driver saved results with coefficients in the correct LINEST order and NRA evidence',
  async (count) => {
    const xs = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : 0, i & 2 ? 1 : 0, i & 4 ? 1 : 0].slice(0, count));
    const drivers = ['HDD', 'CDD', 'DAYLIGHT'].slice(0, count).map((code) => ({ code, unit: 'units' }));
    const observations = xs.map((x, i) => ({
      id: `energy-${i}`,
      drivers: x,
      response:
        100 +
        x.reduce((sum, value, j) => sum + value * (j + 1) * 5, 0) +
        0.5 * (i & 1 ? 1 : -1) * (i & 2 ? 1 : -1) * (i & 4 ? 1 : -1),
    }));
    const fit = fitRegression({
      responseUnit: 'kWh',
      policy: { version: 'test', relativeRankTolerance: 1e-10 },
      drivers,
      observations,
    });
    if (fit.status !== 'FITTED') throw new Error(fit.message);
    const scope = {
      organisationId: '11111111-1111-4111-8111-111111111111',
      siteId: '22222222-2222-4222-8222-222222222222',
    };
    const meterScope = { ...scope, meterId: '33333333-3333-4333-8333-333333333333', energyUseId: null };
    const input: ReportingInput = {
      baseline: {
        id: 'baseline-1',
        scope: meterScope,
        period: { firstMonth: '2020-01', lastMonth: '2020-08' },
        model: projectReportingModel(fit)!,
        referenceObservations: [
          { id: 'population-base', scope, month: '2020-01', kind: 'POPULATION', unit: 'people', value: 10 },
        ],
      },
      period: { firstMonth: '2021-01', lastMonth: '2021-02' },
      policy: {
        version: 'test',
        nra: 'POPULATION',
        significanceBasis: 'POST_NRA',
        comparison: 'GREATER_THAN',
        sigmaMultiplier: 2,
        zeroThreshold: 'UNDEFINED',
        negativePrediction: 'BLOCK',
        extrapolation: 'BLOCK',
      },
      rows: ['2021-01', '2021-02'].map((month, i) => ({
        consumption: { id: `report-${i}`, scope: meterScope, month, kwh: i ? null : 90 },
        drivers: drivers.map((driver) => ({ id: `${month}-${driver.code}`, scope, month, ...driver, value: 0 })),
        nraReferenceMonth: '2020-01',
        nraObservations: [{ id: `population-${i}`, scope, month, kind: 'POPULATION', unit: 'people', value: 20 }],
      })),
    };
    const output = calculateReporting(input);
    if (output.status === 'BLOCKED' || output.rows[0].status !== 'CALCULATED') throw new Error(JSON.stringify(output));
    const run = {
      id: 'run-1',
      inputHash: 'saved-hash',
      createdAt: new Date('2026-10-05T00:00:00Z'),
      baseline: {
        id: 'baseline-1',
        fit,
        snapshot: {
          definition: { period: input.baseline.period },
          assembly: {
            rows: observations.map((observation, i) => ({
              consumption: { id: observation.id, month: `2020-0${i + 1}`, kwh: observation.response },
              drivers: drivers.map((driver, j) => ({ ...driver, value: xs[i][j] })),
            })),
          },
        },
      },
      result: { output },
    } as unknown as Awaited<ReturnType<AnalysisService['readRun']>>;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      (await calculationWorkbook(run, 'Selected site')) as unknown as Parameters<typeof book.xlsx.load>[0],
    );
    const sheet = book.getWorksheet('Regression Analysis')!;
    const find = (label: string) => {
      let found = 0;
      sheet.eachRow((row, index) => {
        if (row.getCell(1).value === label) found = index;
      });
      expect(found).toBeGreaterThan(0);
      return found;
    };
    drivers.forEach((driver, i) =>
      expect(sheet.getCell(find(`${driver.code} coefficient`), 2).formula).toContain(`,1,${count - i})`),
    );
    const expected = sheet.getCell(find('Expected consumption (kWh)'), 2);
    expect(expected.result).toBeCloseTo(output.rows[0].expectedKwh, 10);
    expect(sheet.getCell(find('NRA multiplier'), 2).result).toBe(2);
    expect(sheet.getCell(find('Savings (+) / Waste (−) after NRA'), 2).result).toBeCloseTo(
      output.rows[0].postNraVarianceKwh,
      10,
    );
    expect(sheet.getCell(find('Significant?'), 2).formula).toContain(')>');
    expect(sheet.getCell(find('Actual consumption (kWh)'), 3).value).toBe('Unavailable');
    expect(book.getWorksheet('Saved evidence')!.getCell('B4').value).toBe('saved-hash');
  },
);
