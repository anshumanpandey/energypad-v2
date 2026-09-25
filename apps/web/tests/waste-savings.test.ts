import { describe, expect, it } from 'vitest';
import { wasteSavings, type ImpactReading } from '../src/domain/waste-savings';
import type { ReportingResult } from '../src/domain/analysis/reporting';
import type { CarbonSnapshot } from '../src/domain/carbon';
const row = (month = '2020-01') => ({
  month,
  status: 'CALCULATED' as const,
  actualKwh: 100,
  consumptionId: month,
  driverIds: [],
  expectedKwh: 110,
  nraMultiplier: 0.8,
  adjustedExpectedKwh: 88,
  preNraVarianceKwh: 10,
  postNraVarianceKwh: -12,
  direction: 'WASTE' as const,
  adjustments: [],
  significance: { basis: 'POST_NRA' as const, varianceKwh: -12, thresholdKwh: 5, significant: true },
  warnings: [],
});
const output = (rows = [row()]): ReportingResult =>
  ({
    algorithm: 'energy-reporting-experimental-v1',
    compatibility: 'UNVALIDATED',
    status: 'CALCULATED',
    rows,
    issues: [],
    inputSnapshot: {},
  }) as unknown as ReportingResult;
const reading = (id = '2020-01', extra: Partial<ImpactReading> = {}): ImpactReading => ({
  id,
  revision: 1,
  normalizedKwh: '100',
  netCost: '20',
  currency: 'GBP',
  estimated: false,
  conversionVersion: 'energy-si-v1',
  ...extra,
});
const carbon: CarbonSnapshot = {
  definition: { meterId: 'm', year: 2020, geography: 'GB', basis: 'LOCATION_BASED', requestKey: 'key' },
  meter: { id: 'm', name: 'M', fuel: 'ELECTRICITY' },
  status: 'BLOCKED',
  totalKgCO2e: null,
  rows: [
    {
      month: '2020-01',
      issue: null,
      readingId: '2020-01',
      factorId: 'f1',
      factor: '0.123456789',
      factorRevision: 1,
      source: 'Test',
    },
  ],
};
describe('saved waste and savings impacts', () => {
  it('keeps pre/post NRA signs, exact factor precision and saved significance', () => {
    const result = wasteSavings(output(), [reading()], carbon);
    expect(result).toMatchObject({
      preKwh: '10',
      postKwh: '-12',
      preCost: '2',
      postCost: '-2.4',
      preCarbon: '1.23456789',
      postCarbon: '-1.481481468',
      significantMonths: 1,
    });
    expect(result.rows[0]).toMatchObject({
      factor: { factorId: 'f1' },
      reading: { revision: 1 },
      significance: { basis: 'POST_NRA' },
    });
  });
  it('does not substitute corrected reading IDs or missing factors', () => {
    const mismatch = { ...carbon, rows: [{ ...carbon.rows[0], readingId: 'corrected' }] };
    expect(wasteSavings(output(), [reading()], mismatch).postCarbon).toBeNull();
    expect(wasteSavings(output(), [], null)).toMatchObject({ postCost: null, postCarbon: null, postKwh: '-12' });
  });
  it('does not divide by zero or combine mixed currencies', () => {
    expect(wasteSavings(output(), [reading('2020-01', { normalizedKwh: '0' })], null).postCost).toBeNull();
    const result = wasteSavings(
      output([row(), row('2020-02')]),
      [reading(), reading('2020-02', { currency: 'EUR' })],
      null,
    );
    expect(result.postCost).toBeNull();
    expect(result.currency).toBeNull();
  });
  it('preserves zero cost and factor, including a zero variance', () => {
    expect(
      wasteSavings(output(), [reading('2020-01', { netCost: '0' })], {
        ...carbon,
        rows: [{ ...carbon.rows[0], factor: '0' }],
      }),
    ).toMatchObject({ postCost: '0', postCarbon: '0' });
    expect(
      wasteSavings(output([{ ...row(), preNraVarianceKwh: 0, postNraVarianceKwh: 0 }]), [reading()], carbon).postKwh,
    ).toBe('0');
  });
  it('never treats partial/blocked results as a complete total', () => {
    const partial: ReportingResult = {
      ...output(),
      status: 'INCOMPLETE',
      rows: [row(), { month: '2020-02', status: 'BLOCKED', issues: [] }],
    } as ReportingResult;
    expect(wasteSavings(partial, [reading()], carbon)).toMatchObject({
      preKwh: null,
      postCost: null,
      postCarbon: null,
      complete: false,
    });
    expect(
      wasteSavings(
        {
          algorithm: 'energy-reporting-experimental-v1',
          compatibility: 'UNVALIDATED',
          status: 'BLOCKED',
          issues: [],
          rows: [],
        },
        [],
        null,
      ).postKwh,
    ).toBeNull();
  });
  it('does not upgrade undefined significance or estimated evidence', () => {
    const r = row();
    const data = output([
      { ...r, significance: { ...r.significance, significant: null } } as unknown as ReturnType<typeof row>,
    ]);
    const result = wasteSavings(data, [reading('2020-01', { estimated: true })], null);
    expect(result.significantMonths).toBe(0);
    expect(result.rows[0]).toMatchObject({ reading: { estimated: true }, significance: { significant: null } });
  });
});
