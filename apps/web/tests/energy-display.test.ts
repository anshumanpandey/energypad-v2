import { describe, expect, it } from 'vitest';
import { formatEnergyValue } from '../src/components/format-energy-value';

describe('Energy result display', () => {
  it('rounds results to two decimals without changing source precision', () => {
    const source = '1234.56789';
    expect(formatEnergyValue(source)).toBe('1234.57');
    expect(source).toBe('1234.56789');
    expect(formatEnergyValue(0)).toBe('0.00');
    expect(formatEnergyValue(-12.345)).toBe('-12.35');
    expect(formatEnergyValue(1.5)).toBe('1.50');
  });
  it('keeps missing results distinct from zero', () => {
    for (const value of [null, undefined, '', ' ', NaN, Infinity, 'invalid']) {
      expect(formatEnergyValue(value)).toBe('Unknown');
    }
    expect(formatEnergyValue(null, 'Undefined')).toBe('Undefined');
  });
});
