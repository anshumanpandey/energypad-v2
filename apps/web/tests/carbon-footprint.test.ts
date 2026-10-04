import { it, expect } from 'vitest';
import { carbonRollingMonths, carbonRollingComparison, carbonRecentSummary } from '../src/domain/carbon-footprint';
import type { UtilityGraphRow } from '../src/domain/utility-graphs';
const row: UtilityGraphRow = {
  siteId: 'a',
  siteName: 'A',
  month: '2025-01',
  fuel: 'GAS',
  consumption: '100',
  emissions: '50',
  cost: null,
  currency: null,
  notes: [],
  zeroFilled: false,
};
it('includes the selected month and three previous calendar months across year boundaries', () => {
  expect(carbonRollingMonths('2025', '01')).toEqual(['2024-10', '2024-11', '2024-12', '2025-01']);
  expect(carbonRollingMonths('2025', '')).toEqual([]);
});
it('aggregates actual emissions and uses a site-wide target once', () => {
  const targets = [
    { siteId: 'a', month: row.month, fuel: 'ALL', energy: '150', carbon: '25', cost: null, currency: null },
  ];
  const result = carbonRollingComparison(
    [row, { ...row, fuel: 'ELECTRICITY', emissions: '25' }],
    targets,
    '2025',
    '01',
    '',
  );
  expect(result[3]).toMatchObject({ actual: '75', target: '25', percent: '300.00', issue: null });
  expect(carbonRollingComparison([row], targets, '2025', '01', 'GAS')[3]).toMatchObject({
    target: '25',
    percent: '200.00',
  });
});
it('keeps missing data unavailable and treats zero emissions as a value without dividing by a zero target', () => {
  const targets = [
    { siteId: 'a', month: row.month, fuel: 'GAS', energy: '0', carbon: '0', cost: null, currency: null },
  ];
  const result = carbonRollingComparison([{ ...row, emissions: '0' }], targets, '2025', '01', 'GAS');
  expect(result[0].actual).toBeNull();
  expect(result[3]).toMatchObject({ actual: '0', target: '0', percent: null });
  expect(carbonRecentSummary(result)).toMatchObject({ current: '0', previousAverage: null });
});
it('computes the prior-three-month average only with complete coverage', () => {
  const rows = ['2024-10', '2024-11', '2024-12', '2025-01'].map((month, i) => ({
    ...row,
    month,
    emissions: String((i + 1) * 10),
  }));
  const result = carbonRollingComparison(rows, [], '2025', '01', '');
  expect(carbonRecentSummary(result)).toEqual({ current: '40', previousAverage: '20' });
});
