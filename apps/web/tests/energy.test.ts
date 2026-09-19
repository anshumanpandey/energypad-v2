import { describe, it, expect } from 'vitest';
import { consumptionInput, conversionInput, missingMonths, monthPeriod } from '../src/domain/energy';
describe('monthly consumption', () => {
  const base = { meterId: '123e4567-e89b-42d3-a456-426614174000', month: '2024-02', quantity: '0' };
  it('preserves zero and requires explicit cost currency and valid months', () => {
    expect(consumptionInput.parse(base).quantity).toBe('0');
    expect(consumptionInput.parse({ ...base, netCost: '0', currency: 'gBp' }).currency).toBe('GBP');
    for (const input of [
      { ...base, month: '2024-13' },
      { ...base, quantity: '-1' },
      { ...base, netCost: '10' },
      { ...base, vatPercent: '101' },
    ])
      expect(consumptionInput.safeParse(input).success).toBe(false);
  });
  it('uses half-open calendar months including leap years and reports gaps', () => {
    const { start, end } = monthPeriod('2024-02');
    expect((+end - +start) / 86400000).toBe(29);
    expect(missingMonths(2024, ['2024-02', '2024-02'])).toHaveLength(11);
    expect(missingMonths(2024, ['2024-02'])).not.toContain('2024-02');
  });
});

it('validates sourced conversion ranges and precision', () => {
  const valid = {
    meterId: '123e4567-e89b-42d3-a456-426614174000',
    firstMonth: '2020-01',
    lastMonth: '2020-12',
    factor: '10.123456',
    source: 'Synthetic integration factor',
  };
  expect(conversionInput.safeParse(valid).success).toBe(true);
  for (const input of [
    { ...valid, factor: '0' },
    { ...valid, factor: '-1' },
    { ...valid, factor: '1.1234567' },
    { ...valid, lastMonth: '2019-12' },
    { ...valid, source: ' ' },
  ])
    expect(conversionInput.safeParse(input).success).toBe(false);
});
