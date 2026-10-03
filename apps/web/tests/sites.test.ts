import { describe, it, expect } from 'vitest';
import {
  siteInput,
  manualSiteInput,
  attributesInput,
  mappingInput,
  siteColumnIndex,
  siteTemplateFields,
  siteTemplateAttributeFields,
} from '../src/domain/sites';
import { previewRows } from '../src/server/workbook';
describe('site history and import validation', () => {
  it('accepts manual template fields without a code and preserves omitted fields on edits', () => {
    const input = {
      name: 'London Office',
      address: '1 High Street',
      addressLine2: 'Floor 2',
      town: 'London',
      region: 'London',
      postCode: 'SW1A 1AA',
      attributes: { effectiveFrom: '2026-10-03', population: '0', weeklyHours: '40' },
    };
    expect(manualSiteInput.parse(input).addressLine2).toBe('Floor 2');
    const edit = siteInput.partial().parse({ name: 'Renamed Office' });
    expect(edit).toEqual({ name: 'Renamed Office' });
  });
  it('maps the supplied workbook headers and generates stable internal codes without user input', () => {
    const headers = [
      'Site Name',
      'Address Line 1 ',
      'Address Line 2 ',
      'City',
      'State',
      'Postcode',
      'Population',
      'Work Hours per week',
    ];
    const columns = Object.fromEntries(
      [...siteTemplateFields, ...siteTemplateAttributeFields].map(([field], index) => {
        expect(siteColumnIndex(headers, field)).toBe(index);
        return [field, index];
      }),
    );
    const sheets = [
      {
        name: 'sites',
        headers,
        rows: [
          { row: 2, cells: ['London Office', '1 High Street', 'Floor 2', 'London', 'London', 'SW1A 1AA', '0', '40'] },
          { row: 3, cells: ['Manchester Office', '', '', 'Manchester', '', '', '12', '168'] },
        ],
      },
    ];
    const mapping = mappingInput.parse({
      sheet: 0,
      columns,
      defaults: {},
      effectiveFrom: '2026-10-03',
      confirmCurrentOrganisation: true,
    });
    const result = previewRows(sheets, mapping);
    expect(result.issues).toEqual([]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].data).toMatchObject({
      addressLine2: 'Floor 2',
      town: 'London',
      region: 'London',
      attributes: { population: '0', weeklyHours: '40' },
    });
    expect(result.records[0].data.code).not.toBe(result.records[1].data.code);
    expect(previewRows(sheets, mapping)).toEqual(result);
  });
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
