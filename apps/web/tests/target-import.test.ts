import { describe, expect, it } from 'vitest';
import { parseTargets, targetColumns } from '../src/domain/target-import';
const row = ['site_mit', '2023', 'Jan', 'Grid Electricity', 'kWh', '150', '200'];
const sheet = (rows: string[][], headers = targetColumns) => ({
  name: 'Targets',
  headers,
  rows: rows.map((cells, i) => ({ row: i + 2, cells })),
});
describe('Targets worksheet', () => {
  it('accepts optional target cost and currency in full and compact templates', () => {
    expect(
      parseTargets(
        sheet([[...row, '10', 'GBP', '12']], [...targetColumns, 'Target Cost', 'Currency', 'Target Gross Cost']),
      ).records[0],
    ).toMatchObject({ cost: '10', grossCost: '12', currency: 'GBP' });
    expect(
      parseTargets(sheet([[...row, '0', 'GBP']], [...targetColumns, 'Target Cost', 'Currency'])).records[0],
    ).toMatchObject({ cost: '0', currency: 'GBP' });
    const compact = parseTargets(
      sheet(
        [['site_mit', '2023', 'Jan', '150', '200', '25.50', 'GBP']],
        ['Site Code', 'Year', 'Month', 'Target Energy', 'Target Carbon (Kg)', 'Target Cost', 'Currency'],
      ),
    );
    expect(compact.errors).toEqual([]);
    expect(compact.records[0]).toMatchObject({ fuel: 'ALL', cost: '25.50', currency: 'GBP' });
  });
  it('accepts the fixed format, trimmed headings, zero, month numbers and independent petrol', () => {
    const parsed = parseTargets(
      sheet(
        [row, ['abc', '2024', '12', 'Petrol', 'mwh', '0', '0']],
        targetColumns.map((x) => `${x} `),
      ),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.records[1]).toMatchObject({
      fuel: 'PETROL',
      unit: 'MWh',
      month: '2024-12',
      energy: '0',
      carbon: '0',
    });
  });
  it('lists every invalid cell rather than stopping at the first', () => {
    const result = parseTargets(sheet([['', '99', 'bad', 'unknown', 'litre', '-1', ''], row]));
    expect(result.errors.map((e) => e.cell)).toEqual(['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2']);
    expect(result.records).toHaveLength(1);
  });
  it('rejects both duplicate rows, shifted headers, extra cells and empty files', () => {
    expect(parseTargets(sheet([row, [...row]])).errors.map((e) => e.row)).toEqual([2, 3]);
    expect(
      parseTargets(sheet([[...row, 'extra']], ['Wrong', ...targetColumns.slice(1)])).errors.map((e) => e.cell),
    ).toEqual(['A1', 'H2']);
    expect(parseTargets(sheet([])).errors).toHaveLength(1);
    expect(parseTargets(undefined).errors).toHaveLength(1);
  });
});
