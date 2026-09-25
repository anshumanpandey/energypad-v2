import { describe, expect, it } from 'vitest';
import { expandPlanMonths, monthlyPlanInput } from '../src/domain/monthly-plans';
const input = {
  kind: 'TARGET',
  month: '2020-ALL',
  fuel: 'ELECTRICITY',
  unit: 'kWh',
  energy: '0',
  carbon: '',
  conversionFactor: '1',
  source: 'Test',
  requestKey: '11111111-1111-4111-8111-111111111111',
};
describe('monthly plan contract', () => {
  it('expands all months in order without dividing or changing supplied values', () => {
    expect(expandPlanMonths(monthlyPlanInput.parse(input).month)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2020-${String(i + 1).padStart(2, '0')}`),
    );
    expect(expandPlanMonths('2020-02')).toEqual(['2020-02']);
    expect(monthlyPlanInput.parse(input).energy).toBe('0');
  });
  it('keeps monitoring and consumption targets separate', () => {
    expect(monthlyPlanInput.safeParse({ ...input, energyUseCodes: 'HEATING' }).success).toBe(false);
    expect(monthlyPlanInput.safeParse({ ...input, kind: 'MONITORING' }).success).toBe(false);
    expect(
      monthlyPlanInput.safeParse({ ...input, kind: 'MONITORING', carbon: '0', energyUseCodes: 'HEATING' }).success,
    ).toBe(true);
  });
  it('rejects invalid periods, missing conversion provenance and invalid amounts', () => {
    for (const change of [
      { month: '2020-13' },
      { month: '20-ALL' },
      { energy: '-1' },
      { source: '' },
      { conversionFactor: '0' },
      { conversionFactor: '2' },
      { unit: 'MWh', conversionFactor: '1' },
    ])
      expect(monthlyPlanInput.safeParse({ ...input, ...change }).success).toBe(false);
    expect(
      monthlyPlanInput.safeParse({ ...input, unit: 'MWh', conversionFactor: '1000', energy: '1.234567891' }).success,
    ).toBe(true);
  });
});
