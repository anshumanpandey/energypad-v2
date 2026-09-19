import { describe, it, expect } from 'vitest';
import { siteInput, attributesInput, mappingInput } from '../src/domain/sites';
import { previewRows } from '../src/server/workbook';
describe('site history and import validation', () => {
  it('normalizes currency casing while retaining three-letter validation', () => {
    for (const currency of ['usd', 'Usd', 'USD', ' usd '])
      expect(siteInput.parse({ code: 'X', name: 'Site', currency }).currency).toBe('USD');
    for (const currency of ['US', 'USDD', '12$'])
      expect(siteInput.safeParse({ code: 'X', name: 'Site', currency }).success).toBe(false);
    expect(siteInput.parse({ code: 'X', name: 'Site', currency: null }).currency).toBeNull();
  });
  it('preserves zero and rejects invalid dates, negative values and excessive weekly hours', () => {
    expect(attributesInput.parse({ effectiveFrom: '2026-01-01', population: '0' }).population).toBe('0');
    for (const data of [
      { effectiveFrom: '2026-02-30' },
      { effectiveFrom: '2026-01-01', population: '-1' },
      { effectiveFrom: '2026-01-01', weeklyHours: '169' },
    ])
      expect(attributesInput.safeParse(data).success).toBe(false);
    expect(siteInput.safeParse({ code: 'X', name: 'Site', organisationId: 'untrusted' }).success).toBe(false);
  });
  it('detects duplicate codes and does not import rows from another selected source business', () => {
    const sheets = [
      {
        name: 'Sites',
        headers: ['code', 'name', 'businessEmail'],
        rows: [
          { row: 2, cells: ['A', 'First', 'a@example.test'] },
          { row: 3, cells: ['A', 'Duplicate', 'a@example.test'] },
          { row: 4, cells: ['B', 'Other', 'b@example.test'] },
        ],
      },
    ];
    const mapping = mappingInput.parse({
      sheet: 0,
      columns: { code: 0, name: 1 },
      defaults: {},
      businessEmail: 'a@example.test',
      confirmCurrentOrganisation: true,
    });
    const result = previewRows(sheets, mapping);
    expect(result.records).toHaveLength(2);
    expect(result.issues).toEqual([{ row: 3, field: 'code', message: 'Duplicate site code in this sheet.' }]);
    expect(() => previewRows(sheets, { ...mapping, businessEmail: '' })).toThrow('Choose the source business email');
  });
});
