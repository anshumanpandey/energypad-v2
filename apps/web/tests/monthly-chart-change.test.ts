import { expect, it } from 'vitest';
import { monthlyChartChange } from '../src/domain/monthly-chart-change';

it('compares calendar months regardless of chart sort order, including negative values', () => {
  const points = [
    { month: '2025-03', value: -20 },
    { month: '2025-01', value: 100 },
    { month: '2025-02', value: 50 },
  ];
  expect(monthlyChartChange(points, points[0])).toEqual({
    previousMonth: '2025-02',
    difference: -70,
    percentage: -140,
    direction: 'down',
  });
  expect(monthlyChartChange([{ month: '2025-02', value: -50 }], { month: '2025-03', value: -20 })?.direction).toBe(
    'up',
  );
});
it('compares January with December and handles equal and zero values', () => {
  expect(monthlyChartChange([{ month: '2024-12', value: '0' }], { month: '2025-01', value: 0 })).toEqual({
    previousMonth: '2024-12',
    difference: 0,
    percentage: null,
    direction: 'equal',
  });
});
it('does not replace missing or invalid previous-month values with an earlier month or zero', () => {
  const active = { month: '2025-03', value: 10 };
  expect(monthlyChartChange([{ month: '2025-01', value: 20 }], active)).toBeNull();
  for (const value of [null, NaN, Infinity]) {
    expect(monthlyChartChange([{ month: '2025-02', value }], active)).toBeNull();
    expect(monthlyChartChange([{ month: '2025-02', value: 20 }], { ...active, value })).toBeNull();
  }
});

it('keeps percentage signs aligned with increases and decreases for negative baselines', () => {
  const change = (previous: number, current: number) =>
    monthlyChartChange([{ month: '2025-02', value: previous }], { month: '2025-03', value: current })?.percentage;
  expect(change(100, 120)).toBe(20);
  expect(change(100, 80)).toBe(-20);
  expect(change(-50, -20)).toBe(60);
  expect(change(-50, -80)).toBe(-60);
  expect(change(100, 100)).toBe(0);
  expect(change(0, 20)).toBeNull();
});
