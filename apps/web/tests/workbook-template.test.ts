import { expect, it } from 'vitest';
import {
  applyEnergyTemplate,
  saveEnergyTemplate,
  mapNamedWorkbook,
  parseTemplateText,
  workbookTemplate,
} from '../src/domain/workbook-template';
import { mapDriverWorkbook } from '../src/domain/drivers';
import { mapPatternWorkbook } from '../src/domain/patterns';
const consumption = { name: 'Consumption', headers: ['Month', 'Amount'], rows: [{ row: 2, cells: ['2020-01', '0'] }] };
const driver = { name: 'Drivers', headers: ['Period', 'People'], rows: [{ row: 2, cells: ['2020-01', '0'] }] };
const template = {
  version: 1,
  kind: 'drivers',
  sheetName: 'Drivers',
  columns: { month: 'Period', value: 'People' },
  defaults: { driver: 'POPULATION', source: 'Reviewed attendance' },
};
it('requires explicit selection in a five-sheet workbook and records every excluded sheet', () => {
  const sheets = [
    consumption,
    driver,
    ...['Emissions', 'Targets', 'Patterns'].map((name) => ({ name, headers: [], rows: [] })),
  ];
  expect(() => mapNamedWorkbook(sheets, 'drivers')).toThrow('exact worksheet');
  const selected = mapNamedWorkbook(sheets, 'drivers', undefined, template);
  expect(selected.selection.excludedSheets).toEqual(['Consumption', 'Emissions', 'Targets', 'Patterns']);
  const result = mapDriverWorkbook(selected.sheets);
  expect(result.issues).toEqual([]);
  expect(result.records[0].data.value).toBe('0');
  expect(() => mapNamedWorkbook(sheets, 'drivers', 'Targets', template)).toThrow('disagree');
});
it('reuses named consumption mappings across sheet and column reordering without carrying a meter', () => {
  const saved = saveEnergyTemplate([consumption], {
    sheet: 0,
    columns: { month: 0, quantity: 1 },
    defaults: { unit: 'kWh', estimated: 'actual' },
    confirmed: true,
  });
  const resolved = applyEnergyTemplate([driver, { ...consumption, headers: ['Amount', 'Month'] }], saved);
  expect(resolved.sheet).toBe(1);
  expect(resolved.columns).toEqual({ month: 1, quantity: 0 });
  expect(saved).not.toHaveProperty('meterId');
  expect(() => applyEnergyTemplate([{ ...consumption, headers: ['Month', 'Month'] }], saved)).toThrow('exactly once');
});
it('rejects unknown versions, fields, mismatched kinds, missing sheets, duplicate headers and oversized templates', () => {
  expect(workbookTemplate.safeParse({ ...template, version: 2 }).success).toBe(false);
  expect(workbookTemplate.safeParse({ ...template, columns: { password: 'Secret' } }).success).toBe(false);
  expect(() => applyEnergyTemplate([driver], template)).toThrow('consumption');
  expect(() => mapNamedWorkbook([consumption], 'drivers', undefined, template)).toThrow('exactly one');
  expect(() =>
    mapNamedWorkbook([{ ...driver, headers: ['Period', 'People', 'People'] }], 'drivers', undefined, template),
  ).toThrow('exactly once');
  expect(() => parseTemplateText(' '.repeat(16385))).toThrow('16 KB');
});
it('does not replace blank mapped cells with defaults, and validates mapped setpoints normally', () => {
  const result = mapNamedWorkbook([{ ...driver, rows: [{ row: 8, cells: ['2020-01', ''] }] }], 'drivers', undefined, {
    ...template,
    defaults: { ...template.defaults, value: '50' },
  });
  expect(mapDriverWorkbook(result.sheets).issues[0].row).toBe(8);
  const patterns = mapNamedWorkbook(
    [{ name: 'Setpoints', headers: ['Degrees'], rows: [{ row: 4, cells: ['0'] }] }],
    'patterns',
    undefined,
    {
      version: 1,
      kind: 'patterns',
      sheetName: 'Setpoints',
      columns: { temperature: 'Degrees' },
      defaults: {
        firstDay: '2020-01-01',
        lastDay: '2020-12-31',
        energyUseCode: 'OFFICE',
        daysOnYear: '0',
        temperatureUnit: 'C',
        temperatureContext: 'HEATING',
        source: 'Reviewed setpoint',
      },
    },
  );
  const mapped = mapPatternWorkbook(patterns.sheets);
  expect(mapped.issues).toEqual([]);
  expect(mapped.records[0].data.temperature).toBe('0');
  expect(mapped.records[0].row).toBe(4);
});
