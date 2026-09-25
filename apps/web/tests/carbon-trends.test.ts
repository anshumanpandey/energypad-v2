import { describe, expect, it } from 'vitest';
import {
  carbonTrendPoints,
  aggregateTrend,
  trendTotal,
  trendChange,
  carbonTrendInput,
  type TrendRun,
} from '../src/domain/carbon-trends';
import { monthPeriod } from '../src/domain/energy';
const meter = { id: 'm', name: 'Meter' };
const months = Array.from({ length: 12 }, (_, i) => `2020-${String(i + 1).padStart(2, '0')}`);
const readings = months.map((month) => ({
  id: month,
  meterId: 'm',
  periodStart: monthPeriod(month).start,
  periodEnd: monthPeriod(month).end,
}));
const run = (): TrendRun =>
  ({
    id: 'run',
    algorithmVersion: 'v1',
    createdAt: '2026-01-01',
    snapshot: {
      definition: { year: 2020, meterId: 'm', geography: 'GB', basis: 'LOCATION_BASED', requestKey: 'key' },
      meter,
      status: 'COMPLETE',
      totalKgCO2e: '1.2',
      rows: months.map((month) => ({
        month,
        issue: null,
        readingId: month,
        factorId: 'f',
        kgCO2e: '0.1',
        estimated: month === '2020-02',
      })),
    },
  }) as TrendRun;
const points = (r = run(), ids = new Set(['f']), records = readings) =>
  carbonTrendPoints(2020, [meter], new Map([['m', r]]), records, ids, 'v1');
describe('carbon trend coverage', () => {
  it('preserves exact totals, estimates and immutable evidence references', () => {
    const result = points();
    expect(trendTotal(result)).toBe('1.2');
    expect(result[1]).toMatchObject({ estimated: 1, ready: 1, expected: 1, status: 'COMPLETE' });
    expect(result[0].meters[0]).toMatchObject({ runId: 'run', evidence: { readingId: '2020-01', factorId: 'f' } });
  });
  it('shows valid months from an incomplete annual run without filling gaps', () => {
    const r = run();
    r.snapshot.status = 'BLOCKED';
    r.snapshot.totalKgCO2e = null;
    r.snapshot.rows[1] = { month: '2020-02', issue: 'Missing factor' };
    const result = points(r);
    expect(result[0].kgCO2e).toBe('0.1');
    expect(result[1].kgCO2e).toBeNull();
    expect(result[1].meters[0].status).toBe('BLOCKED');
    expect(trendTotal(result)).toBeNull();
  });
  it('withholds only stale months after reading corrections and all affected factor/method months', () => {
    const changed = readings.map((r, i) => (i === 0 ? { ...r, id: 'corrected' } : r));
    const result = points(run(), new Set(['f']), changed);
    expect(result[0].meters[0].status).toBe('OUTDATED');
    expect(result[1].kgCO2e).toBe('0.1');
    expect(points(run(), new Set())[0].kgCO2e).toBeNull();
    expect(points({ ...run(), algorithmVersion: 'old' })[0].meters[0].status).toBe('OUTDATED');
  });
  it('keeps empty scopes and missing runs unavailable, including an empty portfolio site', () => {
    const empty = carbonTrendPoints(2020, [], new Map(), [], new Set(), 'v1');
    expect(empty[0].status).toBe('EMPTY');
    expect(aggregateTrend([points(), empty])[0].kgCO2e).toBeNull();
    expect(aggregateTrend([])[0]).toMatchObject({ kgCO2e: null, expectedSites: 0 });
    expect(carbonTrendPoints(2020, [meter], new Map(), readings, new Set(['f']), 'v1')[0].meters[0].status).toBe(
      'MISSING',
    );
  });
  it('preserves zero and suppresses undefined percentage changes', () => {
    expect(trendChange('0', '0')).toEqual({ difference: '0', percent: null });
    expect(trendChange('120', '100')).toEqual({ difference: '20', percent: '20' });
    expect(trendChange('0', '100')).toEqual({ difference: '-100', percent: '-100' });
    expect(trendChange(null, '0')).toEqual({ difference: null, percent: null });
    const r = run();
    r.snapshot.rows.forEach((m) => {
      m.kgCO2e = '0';
    });
    expect(trendTotal(points(r))).toBe('0');
  });
  it('rejects identical comparison years and incomplete definitions', () => {
    expect(
      carbonTrendInput.safeParse({
        kind: 'site',
        id: '11111111-1111-4111-8111-111111111111',
        year: 2020,
        comparisonYear: 2020,
        geography: 'GB',
        basis: 'LOCATION_BASED',
      }).success,
    ).toBe(false);
  });
});
