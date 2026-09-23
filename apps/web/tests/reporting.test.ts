import { describe, expect, it } from 'vitest';
import { calculateReporting, projectReportingModel, type ReportingInput } from '../src/domain/analysis/reporting';
import { fitRegression } from '../src/domain/analysis/regression';
const site = { organisationId: '11111111-1111-4111-8111-111111111111', siteId: '22222222-2222-4222-8222-222222222222' };
const scope = { ...site, meterId: '33333333-3333-4333-8333-333333333333', energyUseId: null };
function input(): ReportingInput {
  return {
    baseline: {
      id: 'baseline-1',
      scope,
      period: { firstMonth: '2020-01', lastMonth: '2020-02' },
      model: {
        algorithm: 'ols-qr-experimental-v3',
        compatibility: 'UNVALIDATED',
        responseUnit: 'kWh',
        fitPolicy: { version: 'test', relativeRankTolerance: 1e-10 },
        coefficients: [{ code: 'X', unit: 'units', value: 2, observedRange: { min: 0, max: 20 } }],
        center: { response: 100, drivers: [10] },
        residualStandardError: 5,
      },
      referenceObservations: [],
    },
    period: { firstMonth: '2021-01', lastMonth: '2021-01' },
    policy: {
      version: 'test',
      nra: 'NONE',
      significanceBasis: 'POST_NRA',
      comparison: 'AT_LEAST',
      sigmaMultiplier: 2,
      zeroThreshold: 'UNDEFINED',
      negativePrediction: 'BLOCK',
      extrapolation: 'BLOCK',
    },
    rows: [
      {
        consumption: { id: 'energy-1', scope, month: '2021-01', kwh: 90 },
        drivers: [{ id: 'driver-1', scope: site, month: '2021-01', code: 'X', unit: 'units', value: 10 }],
        nraReferenceMonth: null,
        nraObservations: [],
      },
    ],
  };
}
function calculated(data: ReportingInput) {
  const result = calculateReporting(data);
  expect(result.status).toBe('CALCULATED');
  const row = result.rows[0];
  if (row?.status !== 'CALCULATED') throw new Error(JSON.stringify(result));
  return row;
}
function issue(data: unknown, code: string) {
  expect(calculateReporting(data).issues.map((i) => i.code)).toContain(code);
}
function nra(data: ReportingInput, kind: 'OPERATING_HOURS' | 'POPULATION', reference = 100, reported = 200) {
  const unit = kind === 'POPULATION' ? 'people' : 'hours';
  data.baseline.referenceObservations.push({
    id: `reference-${kind}`,
    scope: site,
    month: '2020-01',
    kind,
    unit,
    value: reference,
  });
  data.rows[0].nraReferenceMonth = '2020-01';
  data.rows[0].nraObservations.push({
    id: `report-${kind}`,
    scope: site,
    month: '2021-01',
    kind,
    unit,
    value: reported,
  });
}
describe('experimental reporting', () => {
  it('preserves evidence and input, predicts centered values and uses expected minus actual', () => {
    const data = input(),
      before = structuredClone(data),
      result = calculateReporting(data);
    expect(calculated(data)).toMatchObject({
      expectedKwh: 100,
      actualKwh: 90,
      nraMultiplier: 1,
      postNraVarianceKwh: 10,
      direction: 'SAVING',
      significance: { thresholdKwh: 10, significant: true },
    });
    expect(data).toEqual(before);
    expect(result).toMatchObject({ compatibility: 'UNVALIDATED', inputSnapshot: before });
    if (result.status !== 'BLOCKED') expect(result.inputSnapshot).not.toBe(data);
  });
  it.each([
    ['HOURS', 'OPERATING_HOURS'],
    ['POPULATION', 'POPULATION'],
  ] as const)('calculates %s ratios', (policy, kind) => {
    const data = input();
    data.policy.nra = policy;
    nra(data, kind);
    expect(calculated(data)).toMatchObject({ nraMultiplier: 2, adjustedExpectedKwh: 200, postNraVarianceKwh: 110 });
  });
  it('multiplies both ratios and selects significance basis explicitly', () => {
    const data = input();
    data.policy.nra = 'HOURS_AND_POPULATION';
    nra(data, 'OPERATING_HOURS', 100, 200);
    nra(data, 'POPULATION', 100, 50);
    expect(calculated(data).nraMultiplier).toBe(1);
    data.rows[0].consumption.kwh = 99;
    data.rows[0].nraObservations[1].value = 100;
    expect(calculated(data).significance.significant).toBe(true);
    data.policy.significanceBasis = 'PRE_NRA';
    expect(calculated(data).significance.significant).toBe(false);
  });
  it('joins reference months explicitly and orders reporting rows chronologically', () => {
    const data = input();
    data.policy.nra = 'POPULATION';
    nra(data, 'POPULATION');
    data.period.lastMonth = '2021-02';
    data.baseline.referenceObservations.push({
      ...data.baseline.referenceObservations[0],
      id: 'ref-feb',
      month: '2020-02',
      value: 400,
    });
    const row = structuredClone(data.rows[0]);
    row.consumption = { ...row.consumption, id: 'energy-feb', month: '2021-02' };
    row.drivers[0] = { ...row.drivers[0], id: 'driver-feb', month: '2021-02' };
    row.nraReferenceMonth = '2020-02';
    row.nraObservations[0] = { ...row.nraObservations[0], id: 'obs-feb', month: '2021-02' };
    data.rows.unshift(row);
    data.baseline.referenceObservations.reverse();
    expect(calculateReporting(data).rows.map((r) => r.status === 'CALCULATED' && [r.month, r.nraMultiplier])).toEqual([
      ['2021-01', 2],
      ['2021-02', 0.5],
    ]);
  });
  it.each([80, 100, 120])('handles signs and inclusive/exclusive boundary for actual %i', (actual) => {
    const data = input();
    data.rows[0].consumption.kwh = actual;
    data.baseline.model.residualStandardError = 10;
    expect(calculated(data).direction).toBe(actual < 100 ? 'SAVING' : actual > 100 ? 'WASTE' : 'NO_CHANGE');
    expect(calculated(data).significance.significant).toBe(actual !== 100);
    data.policy.comparison = 'GREATER_THAN';
    expect(calculated(data).significance.significant).toBe(false);
  });
  it('retains zero values but never substitutes them for missing observations', () => {
    const data = input();
    data.policy.nra = 'POPULATION';
    nra(data, 'POPULATION', 100, 0);
    data.rows[0].consumption.kwh = 0;
    expect(calculated(data)).toMatchObject({ adjustedExpectedKwh: 0, actualKwh: 0, direction: 'NO_CHANGE' });
    data.baseline.referenceObservations[0].value = 0;
    issue(data, 'ZERO_NRA_DENOMINATOR');
    data.baseline.referenceObservations[0].value = null;
    issue(data, 'MISSING_NRA');
    data.rows[0].consumption.kwh = null;
    issue(data, 'MISSING_ACTUAL');
  });
  it('keeps missing months blocked and zero threshold significance explicitly undefined', () => {
    const data = input();
    data.period.lastMonth = '2021-02';
    issue(data, 'MISSING_MONTH');
    expect(calculateReporting(data).status).toBe('INCOMPLETE');
    data.period.lastMonth = '2021-01';
    data.baseline.model.residualStandardError = 0;
    expect(calculated(data).significance.significant).toBeNull();
    data.policy.zeroThreshold = 'COMPARE_NONZERO';
    expect(calculated(data).significance.significant).toBe(true);
    data.rows[0].consumption.kwh = 100;
    expect(calculated(data).significance.significant).toBe(false);
  });
  it('blocks mixed meter/end-use and site/month evidence, duplicate months and conflicting source IDs', () => {
    const data = input();
    data.rows[0].consumption.scope = { ...scope, energyUseId: site.siteId };
    issue(data, 'CONSUMPTION_SCOPE');
    data.rows[0].consumption.scope = scope;
    data.rows[0].drivers[0].month = '2021-02';
    issue(data, 'DRIVER_SCOPE');
    data.rows[0].drivers[0].month = '2021-01';
    data.rows.push(structuredClone(data.rows[0]));
    issue(data, 'DUPLICATE_MONTH');
    data.rows[1].consumption.kwh = 12;
    issue(data, 'SOURCE_ID_CONFLICT');
    data.rows[1].consumption.month = '2022-01';
    issue(data, 'OUTSIDE_REPORTING_PERIOD');
  });
  it('validates NRA scope, reference period, duplicates, units and calendar hours', () => {
    const data = input();
    data.policy.nra = 'HOURS';
    nra(data, 'OPERATING_HOURS');
    data.rows[0].nraObservations[0].scope = { ...site, siteId: scope.meterId };
    issue(data, 'NRA_SCOPE');
    data.rows[0].nraObservations[0].scope = site;
    data.baseline.referenceObservations[0].month = '2019-01';
    issue(data, 'REFERENCE_SCOPE');
    data.baseline.referenceObservations[0].month = '2020-01';
    data.baseline.referenceObservations.push(structuredClone(data.baseline.referenceObservations[0]));
    issue(data, 'DUPLICATE_REFERENCE');
    data.baseline.referenceObservations.pop();
    data.rows[0].nraObservations[0].value = 745;
    issue(data, 'INVALID_INPUT');
    data.rows[0].nraObservations[0].value = 200;
    data.rows[0].nraObservations[0].unit = 'people';
    issue(data, 'INVALID_INPUT');
  });
  it('requires explicit NRA reference month and inputs only when enabled', () => {
    const data = input();
    nra(data, 'POPULATION');
    issue(data, 'UNUSED_NRA');
    data.policy.nra = 'POPULATION';
    data.rows[0].nraReferenceMonth = null;
    issue(data, 'REFERENCE_MONTH');
    data.rows[0].nraReferenceMonth = '2020-01';
    data.rows[0].nraObservations.push(structuredClone(data.rows[0].nraObservations[0]));
    issue(data, 'DUPLICATE_NRA');
  });
  it('matches predictors by code, checks units and blocks missing values', () => {
    const data = input();
    data.baseline.model.coefficients.push({ code: 'Y', unit: 'other', value: 3, observedRange: { min: 0, max: 20 } });
    data.baseline.model.center.drivers.push(5);
    data.rows[0].drivers.unshift({ ...data.rows[0].drivers[0], id: 'driver-y', code: 'Y', unit: 'other', value: 6 });
    expect(calculated(data).expectedKwh).toBe(103);
    expect(calculated(data).driverIds).toEqual(['driver-1', 'driver-y']);
    data.rows[0].drivers[0].unit = 'wrong';
    issue(data, 'DRIVER_UNIT');
    data.rows[0].drivers[0].value = null;
    issue(data, 'MISSING_DRIVER');
    data.rows[0].drivers[0].code = 'X';
    issue(data, 'DRIVER_SHAPE');
  });
  it('requires explicit extrapolation and negative prediction policies', () => {
    const data = input();
    data.rows[0].drivers[0].value = -100;
    issue(data, 'EXTRAPOLATION');
    data.policy.extrapolation = 'ALLOW_WITH_WARNING';
    issue(data, 'NEGATIVE_PREDICTION');
    data.policy.negativePrediction = 'ALLOW_WITH_WARNING';
    expect(calculated(data).warnings).toEqual(['EXTRAPOLATION:X', 'NEGATIVE_PREDICTION']);
  });
  it('rejects overflow and ratio underflow without fabricating zero', () => {
    const data = input();
    data.baseline.model.residualStandardError = Number.MAX_VALUE;
    issue(data, 'NUMERICAL_RANGE');
    data.baseline.model.residualStandardError = 5;
    data.policy.nra = 'POPULATION';
    nra(data, 'POPULATION', Number.MAX_VALUE, Number.MIN_VALUE);
    issue(data, 'NUMERICAL_RANGE');
  });
  it('rejects malformed models, nonfinite inputs and oversized periods', () => {
    const data = input();
    data.baseline.model.center.drivers.push(1);
    issue(data, 'MODEL_SHAPE');
    data.baseline.model.center.drivers.pop();
    data.period.lastMonth = '2031-01';
    issue(data, 'PERIOD_LIMIT');
    data.rows[0].consumption.kwh = NaN;
    issue(data, 'INVALID_INPUT');
  });
  it('projects only fitted kWh models and retains observed predictor ranges', () => {
    const make = (responseUnit: string) =>
      fitRegression({
        responseUnit,
        policy: { version: 'test', relativeRankTolerance: 1e-10 },
        drivers: [{ code: 'X', unit: 'units' }],
        observations: [1, 2, 3, 4].map((x, i) => ({ id: String(i), drivers: [x], response: 10 + x })),
      });
    expect(projectReportingModel(make('kWh'))?.coefficients[0].observedRange).toEqual({ min: 1, max: 4 });
    expect(projectReportingModel(make('MWh'))).toBeNull();
    expect(projectReportingModel(fitRegression({}))).toBeNull();
  });
});
