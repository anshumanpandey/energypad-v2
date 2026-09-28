import { WorkbookCellError } from '../src/domain/workbook-errors';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readWorkbook } from '../src/server/workbook';

async function read(setup: (sheet: ExcelJS.Worksheet, book: ExcelJS.Workbook) => void) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Import');
  setup(sheet, book);
  return readWorkbook(new Uint8Array(await book.xlsx.writeBuffer()));
}

it('imports styled numbers without display rounding, rich text and hyperlink labels', async () => {
  const [sheet] = await read((s) => {
    s.addRow([{ richText: [{ text: 'Quan', font: { bold: true } }, { text: 'tity' }] }, 'Cost', 'Percent', 'Label']);
    s.addRow([1234.5678, 42.3456, 0.2, { text: 'Site A', hyperlink: 'https://example.test' }]);
    s.getCell('A2').numFmt = '#,##0.00';
    s.getCell('B2').numFmt = '£#,##0.00';
    s.getCell('C2').numFmt = '0%';
    s.getCell('A2').font = { bold: true, color: { argb: 'FFFF0000' } };
  });
  expect(sheet.headers[0]).toBe('Quantity');
  expect(sheet.rows[0].cells).toEqual(['1234.5678', '42.3456', '0.2', 'Site A']);
});

it('imports cached regular and shared formulas, including zero, false and empty text', async () => {
  const [sheet] = await read((s) => {
    s.addRow([{ formula: '"Quantity"', result: 'Quantity' }, 'Flag', 'Blank']);
    s.addRow([
      { formula: '1-1', result: 0 },
      { formula: '1=2', result: false },
      { formula: '""', result: '' },
    ]);
    s.addRow([
      { sharedFormula: 'A2', result: 7 },
      { formula: '"yes"', result: 'yes' },
    ]);
  });
  expect(sheet.headers[0]).toBe('Quantity');
  expect(sheet.rows.map((row) => row.cells)).toEqual([
    ['0', 'false', ''],
    ['7', 'yes', ''],
  ]);
});

it.each([false, true])('normalizes formatted dates and formula date results (1904 epoch: %s)', async (date1904) => {
  const [sheet] = await read((s, book) => {
    book.properties.date1904 = date1904;
    s.addRow(['month', 'date', 'formula month']);
    s.addRow([
      new Date('2020-02-01T00:00:00Z'),
      new Date('2020-02-29T00:00:00Z'),
      { formula: 'A2', result: new Date('2020-02-01T00:00:00Z') },
    ]);
    s.getCell('A2').numFmt = 'mmm-yy';
    s.getCell('B2').numFmt = 'dd/mm/yyyy';
    s.getCell('C2').numFmt = 'yyyy-mm';
  });
  expect(sheet.rows[0].cells).toEqual(['2020-02', '2020-02-29', '2020-02']);
});

it.each([{ value: { formula: '1+1' }, message: 'formula has no saved result' }] as const)(
  'rejects unusable cells with a location: $message',
  async ({ value, message }) => {
    await expect(
      read((s) => {
        s.addRow(['Quantity']);
        s.getCell('A2').value = value;
      }),
    ).rejects.toThrow(`Import!A2: ${message}`);
  },
);

it('validates formula headers, excludes credential columns before reading their cells and retains size limits', async () => {
  await expect(
    read((s) => {
      s.getCell('A1').value = { formula: '1+1' };
    }),
  ).rejects.toThrow('Import!A1: formula has no saved result');
  const [sheet] = await read((s) => {
    s.addRow(['Name', { formula: '"Password"', result: 'Password' }]);
    s.addRow(['Site', { formula: '1/0', result: { error: '#DIV/0!' } }]);
  });
  expect(sheet.headers).toEqual(['Name']);
  expect(sheet.rows[0].cells).toEqual(['Site']);
  await expect(
    read((s) => {
      s.addRow(['Name']);
      s.addRow([{ formula: '"long"', result: 'x'.repeat(501) }]);
    }),
  ).rejects.toThrow('at most 500 characters');
});

it('collects every failed cell across sheets without returning partial imports', async () => {
  try {
    await read((s, book) => {
      s.addRow(['Code', 'Name', 'Area', 'Unused', 'Password']);
      s.addRow(['SITE-1', 'Test site', 12.345, { formula: '1/0', result: { error: '#DIV/0!' } }, { error: '#N/A' }]);
      s.addRow(['SITE-2', 'Other site', { error: '#N/A' }, { error: '#VALUE!' }]);
      s.addRow([{ formula: 'A3', result: { error: '#REF!' } }, 'x'.repeat(501)]);
      const other = book.addWorksheet('Other');
      other.addRow([{ error: '#REF!' }, 'Value']);
      other.addRow(['valid', { formula: '1+1' }]);
    });
    expect.fail('An invalid workbook must not be returned');
  } catch (error) {
    expect(error).toBeInstanceOf(WorkbookCellError);
    const issues = (error as WorkbookCellError).cellErrors;
    expect(issues.map((item) => `${item.sheet}!${item.cell}`)).toEqual([
      'Import!D2',
      'Import!C3',
      'Import!D3',
      'Import!A4',
      'Import!B4',
      'Other!A1',
      'Other!B2',
    ]);
    expect(issues[0]).toMatchObject({ row: 2, column: 4, message: expect.stringContaining('Excel error cell') });
    expect(JSON.stringify(issues)).not.toContain('SITE-1');
    expect(JSON.stringify(issues)).not.toContain('x'.repeat(501));
  }
});
