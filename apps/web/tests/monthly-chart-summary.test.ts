import { it, expect } from 'vitest';
import { monthlyChartSummary, monthlyActuals } from '../src/domain/monthly-chart-summary';
it('uses calendar days and compares January to the previous December', () => {
  expect(monthlyChartSummary([{ month: '2025-04', actual: '120' }], '2025-04').dailyAverage).toBe('4');
  expect(
    monthlyChartSummary(
      [
        { month: '2025-12', actual: '310' },
        { month: '2026-01', actual: '620' },
      ],
      '2026-01',
    ),
  ).toMatchObject({ current: '620', dailyAverage: '20', previous: '310', percent: 100 });
  expect(monthlyChartSummary([{ month: '2024-02', actual: '290' }], '2024-02').dailyAverage).toBe('10');
});
it('shows decreases and preserves missing data and zero baselines', () => {
  expect(
    monthlyChartSummary(
      [
        { month: '2026-01', actual: '100' },
        { month: '2026-02', actual: '50' },
      ],
      '2026-02',
    ).percent,
  ).toBe(-50);
  expect(
    monthlyChartSummary(
      [
        { month: '2026-01', actual: '0' },
        { month: '2026-02', actual: '50' },
      ],
      '2026-02',
    ).percent,
  ).toBeNull();
  expect(
    monthlyActuals(
      [
        { month: '2026-01', amount: '0.1' },
        { month: '2026-01', amount: '0.2' },
      ],
      'amount',
    )[0].actual,
  ).toBe('0.3');
  expect(
    monthlyActuals(
      [
        { month: '2026-01', amount: '100' },
        { month: '2026-01', amount: null },
      ],
      'amount',
    )[0].actual,
  ).toBeNull();
});
