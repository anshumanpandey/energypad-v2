import { expect, it } from 'vitest';
import { missingImportMonths } from '../src/domain/import-missing-months';

const rows = [
  { site: 'London', month: '2025-01', scope: 'Gas · Heating', quantity: '45' },
  { site: 'London', month: '2025-03', scope: 'Gas · Heating', quantity: '0' },
];
const identity = (r: (typeof rows)[number]) => ({ site: r.site, scope: r.scope });
const zero = (r: (typeof rows)[number], month: string) => ({ ...r, month, quantity: '0' });
it('warns about missing months without generating zeroes before confirmation', () => {
  const result = missingImportMonths(rows, identity, zero, false);
  expect(result.records).toEqual(rows);
  expect(result.missingMonths).toHaveLength(10);
  expect(result.missingMonths[0]).toEqual({ site: 'London', month: '2025-02', scope: 'Gas · Heating' });
  expect(result.missingMonths.some((r) => r.month === '2025-03')).toBe(false);
});
it('fills gaps only for represented site/year/utility/end-use groups after confirmation', () => {
  const source = [...rows, { site: 'Leeds', month: '2026-02', scope: 'PV · Cooling', quantity: '4' }];
  const result = missingImportMonths(source, identity, zero, true);
  expect(result.records).toHaveLength(24);
  expect(result.records.filter((r) => r.site === 'London')).toHaveLength(12);
  expect(result.records.filter((r) => r.site === 'Leeds')).toHaveLength(12);
  expect(result.records.find((r) => r.site === 'London' && r.month === '2025-01')?.quantity).toBe('45');
  expect(missingImportMonths([], identity, zero, true).records).toEqual([]);
});
