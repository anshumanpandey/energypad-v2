import { describe, expect, it } from 'vitest';
import { overviewEnergy, type OverviewReading } from '../src/domain/overview';
import { monthPeriod } from '../src/domain/energy';
const reading = (month: number, extra: Partial<OverviewReading> = {}): OverviewReading => {
  const period = monthPeriod(`2020-${String(month).padStart(2, '0')}`);
  return {
    id: `r${month}`,
    meterId: 'm',
    revision: 1,
    periodStart: period.start,
    periodEnd: period.end,
    normalizedKwh: '0.1',
    netCost: '0.2',
    currency: 'GBP',
    estimated: false,
    conversionVersion: 'energy-si-v1',
    ...extra,
  };
};
const year = () => Array.from({ length: 12 }, (_, i) => reading(i + 1));
describe('overview coverage and totals', () => {
  it('sums exact decimals, retains provenance and separates empty scope from recorded zero', () => {
    expect(overviewEnergy(2020, ['m'], year())).toMatchObject({ kwh: '1.2', netCost: '2.4', completeMonths: 12 });
    expect(overviewEnergy(2020, [], []).kwh).toBeNull();
    expect(
      overviewEnergy(
        2020,
        ['m'],
        year().map((r) => ({ ...r, normalizedKwh: '0', netCost: '0' })),
      ),
    ).toMatchObject({ kwh: '0', netCost: '0' });
    expect(overviewEnergy(2020, ['m'], [reading(1, { revision: 2, estimated: true })]).months[0]).toMatchObject({
      estimated: 1,
      evidence: [{ id: 'r1', revision: 2, conversionVersion: 'energy-si-v1' }],
    });
  });
  it('blocks incomplete, duplicate and partial periods without losing complete monthly values', () => {
    expect(overviewEnergy(2020, ['m'], year().slice(1))).toMatchObject({ kwh: null, completeMonths: 11 });
    expect(overviewEnergy(2020, ['m'], [...year(), reading(1)]).months[0].kwh).toBeNull();
    expect(overviewEnergy(2020, ['m'], [reading(1, { periodEnd: new Date('2020-01-15') })]).months[0].kwh).toBeNull();
    expect(overviewEnergy(2020, ['m', 'missing'], year()).kwh).toBeNull();
  });
  it('does not combine currencies or invent missing costs; ignores out-of-scope meters', () => {
    const rows = year();
    rows[0] = reading(1, { currency: 'EUR' });
    expect(overviewEnergy(2020, ['m'], rows)).toMatchObject({ kwh: '1.2', netCost: null });
    rows[0] = reading(1, { netCost: null });
    expect(overviewEnergy(2020, ['m'], rows).months[0].netCost).toBeNull();
    expect(
      overviewEnergy(2020, ['m'], [...year(), reading(1, { meterId: 'archived', normalizedKwh: '999' })]).kwh,
    ).toBe('1.2');
  });
});
