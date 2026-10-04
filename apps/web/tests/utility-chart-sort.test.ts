import { it, expect } from 'vitest';
import { sortChartValues } from '../src/domain/utility-chart-sort';
it('ranks actual values numerically, keeps zeros, puts missing values last and breaks ties by month', () => {
  const rows = [
    { month: '2026-01', actual: null },
    { month: '2026-02', actual: '10' },
    { month: '2026-03', actual: '2' },
    { month: '2026-04', actual: '0' },
    { month: '2026-05', actual: '10' },
  ];
  const months = (order: 'month' | 'high-to-low' | 'low-to-high') =>
    sortChartValues(rows, order, (r) => r.actual).map((r) => r.month);
  expect(months('high-to-low')).toEqual(['2026-02', '2026-05', '2026-03', '2026-04', '2026-01']);
  expect(months('low-to-high')).toEqual(['2026-04', '2026-03', '2026-02', '2026-05', '2026-01']);
  expect(months('month')).toEqual(rows.map((r) => r.month));
  expect(rows[0].month).toBe('2026-01');
});
