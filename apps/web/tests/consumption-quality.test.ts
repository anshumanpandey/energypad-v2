import { expect, it } from 'vitest';
import { latestConsumptionQuality } from '../src/domain/consumption-quality';

it('uses latest attributes, preserves reading warnings and leaves recorded flags unchanged', () => {
  const recorded = [
    'Estimated reading',
    'Missing population',
    'Missing floor area',
    'VAT unknown; gross cost unavailable',
  ];
  expect(latestConsumptionQuality(recorded, { population: '0', weeklyHours: null, floorArea: '100' })).toEqual([
    'Estimated reading',
    'VAT unknown; gross cost unavailable',
    'Missing weekly operating hours',
  ]);
  expect(recorded).toContain('Missing population');
  expect(latestConsumptionQuality([], null)).toEqual([
    'Missing population',
    'Missing weekly operating hours',
    'Missing floor area',
  ]);
  expect(latestConsumptionQuality(recorded.slice(1, 3), { population: 0, weeklyHours: 0, floorArea: 0 })).toEqual([]);
});
