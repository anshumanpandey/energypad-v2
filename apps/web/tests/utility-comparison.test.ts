import { it, expect } from 'vitest';
import { utilityComparison } from '../src/domain/utility-comparison';
import { importedFuel } from '../src/domain/imported-fuel';
import type { UtilityGraphRow } from '../src/domain/utility-graphs';
const row: UtilityGraphRow = {
  siteId: 'a',
  siteName: 'A',
  month: '2025-01',
  fuel: 'GAS',
  consumption: '0.1',
  emissions: null,
  cost: '0.1',
  currency: 'GBP',
  notes: [],
  zeroFilled: false,
};
it('distinguishes imported diesel and petrol from genuine oil', () => {
  expect(importedFuel('OIL', { utilityType: 'Diesel' })).toBe('DIESEL');
  expect(importedFuel('OIL', { utilityType: 'Petrol' })).toBe('PETROL');
  expect(importedFuel('OIL', { utilityType: 'Oil' })).toBe('OIL');
  expect(importedFuel('PETROL', null)).toBe('PETROL');
});
it('uses a site-wide target once, keeps decimal precision and preserves a zero cost target', () => {
  const targets = [{ siteId: 'a', month: row.month, fuel: 'ALL', energy: '12', cost: '0', currency: 'GBP' }];
  const result = utilityComparison(
    [row, { ...row, fuel: 'ELECTRICITY', consumption: '0.2', cost: '0.2' }],
    targets,
    '',
  )[0];
  expect(result).toMatchObject({ consumption: '0.3', cost: '0.3', targetEnergy: '12', targetCost: '0' });
  expect(utilityComparison([row], targets, 'GAS')[0].targetCost).toBeNull();
});
it('does not invent target costs or sum mixed currencies', () => {
  expect(utilityComparison([row], [], '')[0].targetCost).toBeNull();
  expect(utilityComparison([row, { ...row, fuel: 'ELECTRICITY', currency: 'USD' }], [], '')[0].cost).toBeNull();
});
