import { describe, expect, it } from 'vitest';
import { aggregatePortfolioEnergy, portfolioEnergyInput, type SiteEnergy } from '../src/domain/portfolio-energy';
import { overviewEnergy } from '../src/domain/overview';
import { monthPeriod } from '../src/domain/energy';
function site(id: string, currency = 'GBP', quantity = '0.1'): SiteEnergy {
  const records = Array.from({ length: 12 }, (_, i) => {
    const { start, end } = monthPeriod(`2020-${String(i + 1).padStart(2, '0')}`);
    return {
      id: `${id}-${i}`,
      meterId: id,
      revision: 1,
      periodStart: start,
      periodEnd: end,
      normalizedKwh: quantity,
      netCost: '0.2',
      currency,
      estimated: false,
      conversionVersion: 'v1',
    };
  });
  return {
    id,
    name: id,
    code: id,
    meters: [{ id, name: id, fuel: 'ELECTRICITY' }],
    energy: overviewEnergy(2020, [id], records),
  };
}
describe('portfolio energy aggregation', () => {
  it('reconciles exact monthly and annual totals and preserves real zero', () => {
    expect(aggregatePortfolioEnergy(2020, [site('a'), site('b')])).toMatchObject({
      status: 'COMPLETE',
      kwh: '2.4',
      netCost: '4.8',
      currency: 'GBP',
    });
    expect(aggregatePortfolioEnergy(2020, [site('a', 'GBP', '0')]).kwh).toBe('0');
  });
  it('withholds empty and incomplete totals, retaining complete months', () => {
    expect(aggregatePortfolioEnergy(2020, [])).toMatchObject({ status: 'EMPTY', kwh: null, netCost: null });
    const missing = site('b');
    missing.energy.months[1].kwh = null;
    missing.energy.months[1].netCost = null;
    missing.energy.months[1].complete = false;
    const result = aggregatePortfolioEnergy(2020, [site('a'), missing]);
    expect(result).toMatchObject({ status: 'INCOMPLETE', kwh: null, netCost: null });
    expect(result.months[0].kwh).toBe('0.2');
    expect(result.months[1].kwh).toBeNull();
    const empty = { ...site('c'), meters: [], energy: overviewEnergy(2020, [], []) };
    expect(aggregatePortfolioEnergy(2020, [site('a'), empty]).kwh).toBeNull();
  });
  it('never combines currencies across sites or months or substitutes missing costs', () => {
    expect(aggregatePortfolioEnergy(2020, [site('a'), site('b', 'EUR')])).toMatchObject({
      kwh: '2.4',
      netCost: null,
      currency: null,
    });
    const changed = site('a');
    changed.energy.months[0].currency = 'EUR';
    expect(aggregatePortfolioEnergy(2020, [changed]).netCost).toBeNull();
    changed.energy.months[0].netCost = null;
    expect(aggregatePortfolioEnergy(2020, [changed]).months[0].netCost).toBeNull();
  });
  it('validates year, fuel and site scope inputs', () => {
    expect(portfolioEnergyInput.parse({ year: 2020 }).fuel).toBe('ALL');
    for (const value of [{ year: 1800 }, { year: 2020, fuel: 'invented' }, { year: 2020, siteId: 'bad' }])
      expect(portfolioEnergyInput.safeParse(value).success).toBe(false);
  });
});
