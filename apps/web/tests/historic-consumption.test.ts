import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { historicColumns, historicSheet, parseHistoric } from '../src/domain/historic-consumption';
import { readWorkbook } from '../src/server/workbook';
import type { WorkbookCellIssue } from '../src/domain/workbook-errors';
const cells = ['London', '2023', 'Jan', 'Heating', 'Gas', '', '45', 'kWh', '600', '60', '1', '120', '9'];
const sheet = (rows = [cells]) => ({
  name: historicSheet,
  headers: [...historicColumns],
  rows: rows.map((cells, i) => ({ row: i + 2, cells })),
});
describe('fixed historic consumption template', () => {
  it('keeps Solar PV separate from grid electricity regardless of casing', () => {
    for (const label of ['Solar PV', 'solar pv', 'SOLAR PV']) {
      const row = [...cells];
      row[4] = label;
      expect(parseHistoric(sheet([row])).records[0].fuel).toBe('SOLAR_PV');
    }
    const row = [...cells];
    row[4] = 'Grid Electricity';
    expect(parseHistoric(sheet([row])).records[0].fuel).toBe('ELECTRICITY');
  });
  it('retains gross cost, exact VAT and daily hours; normalizes template units', () => {
    const parsed = parseHistoric(sheet());
    expect(parsed.errors).toEqual([]);
    expect(parsed.records[0]).toMatchObject({
      month: '2023-01',
      grossCost: '600',
      vatCost: '60',
      dailyHours: '9',
      population: '120',
    });
    expect(parseHistoric(sheet([[...cells.slice(0, 7), 'l', ...cells.slice(8)]])).records[0].unit).toBe('litre');
  });
  it('reports all bad cells across rows, including headers, year, quantity and daily hours', () => {
    const bad = [...cells];
    bad[1] = '23';
    bad[6] = 'oops';
    bad[12] = '25';
    const input = sheet([bad, bad]);
    input.headers[0] = 'Year';
    expect(parseHistoric(input).errors.map((e) => e.cell)).toEqual(['A1', 'B2', 'G2', 'M2', 'B3', 'G3', 'M3']);
  });
  it('requires both cost columns and prevents VAT exceeding total', () => {
    const bad = [...cells];
    bad[9] = '601';
    expect(parseHistoric(sheet([bad])).errors.map((e) => e.cell)).toContain('J2');
    bad[9] = '';
    expect(parseHistoric(sheet([bad])).errors.map((e) => e.cell)).toContain('J2');
  });
  it('keeps zeroes and allows absent optional values', () => {
    const row = [...cells];
    for (const i of [6, 8, 9, 12]) row[i] = '0';
    row[11] = '';
    expect(parseHistoric(sheet([row])).errors).toEqual([]);
    row[8] = '';
    row[9] = '';
    row[12] = '';
    expect(parseHistoric(sheet([row])).errors).toEqual([]);
  });
  it('combines Excel error cells and invalid formats while accepting cached formulas and ignoring other sheets', async () => {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet(historicSheet);
    s.addRow(historicColumns);
    s.addRow(cells);
    s.getCell('J2').value = { formula: 'I2/10', result: 60 };
    s.getCell('G2').value = 45.123;
    s.getCell('G2').numFmt = '0.0';
    book.addWorksheet('Other').getCell('A1').value = { error: '#VALUE!' };
    const errors: WorkbookCellIssue[] = [];
    const result = await readWorkbook(new Uint8Array(await book.xlsx.writeBuffer()), {
      sheetName: historicSheet,
      cellErrors: errors,
    });
    expect(parseHistoric(result[0], errors).records[0]).toMatchObject({ quantity: '45.123', vatCost: '60' });
    s.getCell('J2').value = { error: '#DIV/0!' };
    s.getCell('B2').value = 'bad';
    const issues: WorkbookCellIssue[] = [];
    const bad = await readWorkbook(new Uint8Array(await book.xlsx.writeBuffer()), {
      sheetName: historicSheet,
      cellErrors: issues,
    });
    expect(parseHistoric(bad[0], issues).errors.map((e) => e.cell)).toEqual(['J2', 'B2']);
  });
});
