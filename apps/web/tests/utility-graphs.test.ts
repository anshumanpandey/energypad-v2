import { describe, it, expect } from 'vitest';
import { filterUtilityRows, type UtilityGraphRow } from '../src/domain/utility-graphs';
const row: UtilityGraphRow = {
  siteId: 'a',
  siteName: 'A',
  fuel: 'GAS',
  month: '2025-01',
  consumption: '0',
  emissions: null,
  cost: null,
  currency: null,
  notes: ['Missing factor'],
  zeroFilled: true,
};
const rows = [row, { ...row, siteId: 'b', fuel: 'ELECTRICITY', month: '2026-02' }, { ...row, month: '2025-02' }];
describe('utility graph selection', () => {
  it('keeps all sites and years by default, including zero and missing emissions', () => {
    expect(filterUtilityRows(rows, { site: '', year: '', month: '', fuel: '' })).toEqual(rows);
  });
  it('combines site, year, month and fuel filters', () => {
    expect(filterUtilityRows(rows, { site: 'a', year: '2025', month: '01', fuel: 'GAS' })).toEqual([row]);
    expect(filterUtilityRows(rows, { site: 'b', year: '2025', month: '', fuel: '' })).toEqual([]);
  });
});
