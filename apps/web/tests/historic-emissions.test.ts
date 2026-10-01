import { describe, expect, it } from 'vitest';
import { emissionsColumns, parseEmissions } from '../src/domain/historic-emissions';
const row = ['site_mit', '2024', 'Jan', 'Grid Electricity', 'kWh', '0.5'];
const sheet = (rows: string[][], headers = emissionsColumns) => ({
  name: 'Emissions',
  headers,
  rows: rows.map((cells, i) => ({ row: i + 2, cells })),
});
describe('fixed Emissions worksheet', () => {
  it.each(['Petrol', 'petrol', 'PETROL'])('accepts emission factors for %s', (label) => {
    const data = [...row];
    data[3] = label;
    const parsed = parseEmissions(sheet([data]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.records[0].fuel).toBe('PETROL');
  });
  it('accepts the reference blank A1, zero factors and normalized utilities', () => {
    const result = parseEmissions(
      sheet([[...row.slice(0, 3), 'solar pv', 'KWH', '0']], ['', ...emissionsColumns.slice(1)]),
    );
    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({ month: '2024-01', fuel: 'SOLAR_PV', factor: '0' });
  });
  it('lists every malformed cell rather than stopping at the first error', () => {
    const result = parseEmissions(sheet([['', 'no', '13', 'invalid', 'litres', '-1']]));
    expect(result.errors.map((e) => e.cell)).toEqual(['A2', 'B2', 'C2', 'D2', 'E2', 'F2']);
  });
  it('rejects shifted headers and data outside the fixed layout', () => {
    const result = parseEmissions(
      sheet([[...row, 'extra']], ['Year', 'Site Code', ...emissionsColumns.slice(2), 'Extra']),
    );
    expect(result.errors.map((e) => e.cell)).toEqual(['A1', 'B1', 'G1', 'G2']);
  });
  it('flags both occurrences of duplicate site/month/fuel including aliases', () => {
    const result = parseEmissions(sheet([row, ['SITE_MIT', '2024', '1', 'Electricity', 'kWh', '0.6']]));
    expect(result.errors.map((e) => e.cell)).toEqual(['F2', 'F3']);
  });
  it('reports missing sheets and empty data', () => {
    expect(parseEmissions(undefined).errors[0].cell).toBe('A1');
    expect(parseEmissions(sheet([])).errors[0].cell).toBe('A2');
  });
});
