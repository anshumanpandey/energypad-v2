import { describe, expect, it } from 'vitest';
import { benchmarkEnergy, rankSites, benchmarkInput } from '../src/domain/benchmarking';
import { monthPeriod } from '../src/domain/energy';
import type { OverviewReading } from '../src/domain/overview';
const reading = (month: number, extra: Partial<OverviewReading> = {}): OverviewReading => {
  const p = monthPeriod(`2020-${String(month).padStart(2, '0')}`);
  return {
    id: String(month),
    meterId: 'm',
    revision: 1,
    periodStart: p.start,
    periodEnd: p.end,
    normalizedKwh: '0.1',
    netCost: '0.2',
    currency: 'GBP',
    estimated: false,
    conversionVersion: 'v1',
    ...extra,
  };
};
const rows = [
  { id: 'a', code: 'B', kwh: '2', netCost: '0' },
  { id: 'b', code: 'A', kwh: '2.0', netCost: null },
  { id: 'c', code: 'C', kwh: null, netCost: '1' },
  { id: 'd', code: 'D', kwh: '10', netCost: '2' },
];
describe('site benchmarking', () => {
  it('uses numeric ordering, shared ranks, deterministic ties and unranked missing values', () => {
    expect(rankSites(rows, 'kwh', 'asc').map((r) => [r.id, r.rank])).toEqual([
      ['b', 1],
      ['a', 1],
      ['d', 3],
      ['c', null],
    ]);
    expect(rankSites(rows, 'kwh', 'desc').map((r) => [r.id, r.rank])).toEqual([
      ['d', 1],
      ['b', 2],
      ['a', 2],
      ['c', null],
    ]);
    expect(rankSites(rows, 'netCost', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('compares only the selected full month; annual incompleteness is explicit', () => {
    const records = [reading(2, { estimated: true }), reading(3, { normalizedKwh: '999' })];
    expect(benchmarkEnergy(2020, 2, 'GBP', ['m'], records)).toMatchObject({
      kwh: '0.1',
      netCost: '0.2',
      completeMonths: 1,
      expectedMonths: 1,
      estimated: 1,
    });
    expect(benchmarkEnergy(2020, 0, 'GBP', ['m'], records)).toMatchObject({
      kwh: null,
      netCost: null,
      completeMonths: 2,
      expectedMonths: 12,
    });
  });
  it('never ranks partial meters, partial months or another currency as complete', () => {
    expect(benchmarkEnergy(2020, 1, 'EUR', ['m'], [reading(1)])).toMatchObject({ kwh: '0.1', netCost: null });
    expect(benchmarkEnergy(2020, 1, 'GBP', ['m', 'missing'], [reading(1)]).kwh).toBeNull();
    expect(benchmarkEnergy(2020, 1, 'GBP', ['m'], [reading(1, { periodEnd: new Date('2020-01-15') })]).kwh).toBeNull();
    expect(benchmarkEnergy(2020, 1, 'GBP', [], []).kwh).toBeNull();
  });
  it('retains exact totals, zero, original currency evidence and revisions', () => {
    const all = Array.from({ length: 12 }, (_, i) => reading(i + 1));
    expect(benchmarkEnergy(2020, 0, 'GBP', ['m'], all)).toMatchObject({ kwh: '1.2', netCost: '2.4' });
    const zero = benchmarkEnergy(
      2020,
      1,
      'GBP',
      ['m'],
      [reading(1, { normalizedKwh: '0', netCost: '0', revision: 2 })],
    );
    expect(zero).toMatchObject({ kwh: '0', netCost: '0' });
    expect(zero.months[0].evidence[0].revision).toBe(2);
  });
  it('rejects inconsistent filter values', () => {
    expect(benchmarkInput.safeParse({ year: 2020, geography: 'GB', basis: 'LOCATION_BASED', month: 13 }).success).toBe(
      false,
    );
    expect(
      benchmarkInput.safeParse({ year: 2020, geography: 'GB', basis: 'LOCATION_BASED', metric: 'injected' }).success,
    ).toBe(false);
  });
});
