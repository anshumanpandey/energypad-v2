import { it, expect } from 'vitest';
import { energyMappingInput, mapEnergyRows } from '../src/domain/energy-import';
const meter = '123e4567-e89b-42d3-a456-426614174000';
const sheets = [{ name: 'Readings', headers: ['month', 'quantity'], rows: [{ row: 2, cells: ['2020-01', '0'] }] }];
const mapping = energyMappingInput.parse({
  sheet: 0,
  columns: { month: 0, quantity: 1 },
  defaults: { unit: 'kWh', estimated: 'actual' },
  confirmed: true,
});
it('requires source units and imports Actual readings while preserving zero', () => {
  const result = mapEnergyRows(sheets, mapping, meter, 'kWh');
  expect(result.issues).toEqual([]);
  expect(result.records[0].data.quantity).toBe('0');
  expect(result.records[0].data.estimated).toBe(false);
  expect(result.records[0].data.netCost).toBeNull();
  expect(mapEnergyRows(sheets, { ...mapping, defaults: {} }, meter, 'kWh').issues.map((i) => i.field)).toEqual([
    'unit',
  ]);
});
it('rejects duplicate months, missing columns, unsupported dates and oversized sheets', () => {
  expect(
    mapEnergyRows(
      [{ ...sheets[0], rows: [...sheets[0].rows, { row: 3, cells: ['2020-01', '1'] }] }],
      mapping,
      meter,
      'kWh',
    ).issues,
  ).toContainEqual({ row: 3, field: 'month', message: 'Duplicate month in this sheet.' });
  expect(() => mapEnergyRows(sheets, { ...mapping, columns: { month: 49 } }, meter, 'kWh')).toThrow();
  expect(
    mapEnergyRows([{ ...sheets[0], rows: [{ row: 2, cells: ['Jan 2020', '1'] }] }], mapping, meter, 'kWh').issues
      .length,
  ).toBeGreaterThan(0);
  expect(() =>
    mapEnergyRows(
      [{ ...sheets[0], rows: Array.from({ length: 121 }, () => sheets[0].rows[0]) }],
      mapping,
      meter,
      'kWh',
    ),
  ).toThrow('1–120');
});

it('ignores obsolete estimated status mappings without requiring a status column', () => {
  const legacy = energyMappingInput.parse({
    sheet: 0,
    columns: { month: 0, quantity: 1, estimated: 49 },
    defaults: { unit: 'kWh', estimated: 'estimated' },
    confirmed: true,
  });
  const result = mapEnergyRows(sheets, legacy, meter, 'kWh');
  expect(result.issues).toEqual([]);
  expect(result.records[0].data.estimated).toBe(false);
});
