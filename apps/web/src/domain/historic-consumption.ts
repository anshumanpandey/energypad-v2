import type { ImportSheet } from './sites';
import type { WorkbookCellIssue } from './workbook-errors';

export const historicSheet = 'Historic Consumption';
export const historicColumns = [
  'Site Code',
  'Year',
  'Month',
  'Energy Use',
  'Utility Type',
  'MPAN/MPRN',
  'Consumption',
  'Fuel Unit',
  'Total Cost',
  'VAT Cost',
  'Conversion Factor',
  'Population',
  'Operating Hours',
];
export const historicCompactColumns = historicColumns.filter((_, i) => i !== 5);
export const isCompactHistoric = (headers: readonly string[]) =>
  headers[5]?.trim().toLowerCase() === 'consumption' || headers[6]?.trim().toLowerCase() === 'fuel unit';
export const historicIgnoredColumns = (headers: readonly string[]) => (isCompactHistoric(headers) ? [] : [6]);
export const historicSourceColumn = (headers: readonly string[], column: number) =>
  isCompactHistoric(headers) && column > 6 ? column - 1 : column;
const fuels: Record<string, string> = {
  electricity: 'ELECTRICITY',
  'grid electricity': 'ELECTRICITY',
  'solar pv': 'SOLAR_PV',
  gas: 'GAS',
  diesel: 'OIL',
  'bio diesel': 'BIODIESEL',
  biodiesel: 'BIODIESEL',
  oil: 'OIL',
  petrol: 'PETROL',
  lpg: 'LPG',
  biomass: 'BIOMASS',
  heat: 'HEAT',
  other: 'OTHER',
};
const units: Record<string, string> = {
  kwh: 'kWh',
  mwh: 'MWh',
  m3: 'm3',
  'm³': 'm3',
  l: 'litre',
  litre: 'litre',
  kg: 'kg',
};
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function historicIssue(row: number, column: number, message: string): WorkbookCellIssue {
  let letters = '',
    n = column;
  while (n > 0) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return { sheet: historicSheet, cell: `${letters}${row}`, row, column, message };
}
export function parseHistoric(sheet: ImportSheet | undefined, errors: WorkbookCellIssue[] = []) {
  const records: {
    row: number;
    siteCode: string;
    month: string;
    endUse: string;
    utility: string;
    fuel: string;
    quantity: string;
    unit: string;
    grossCost: string | null;
    vatCost: string | null;
    factor: string;
    population: string | null;
    dailyHours: string | null;
    zeroFilled?: boolean;
  }[] = [];
  const sourceHeaders = sheet?.headers ?? [];
  const compact = isCompactHistoric(sourceHeaders);
  if (sheet && compact)
    sheet = {
      ...sheet,
      headers: [...sheet.headers.slice(0, 5), '', ...sheet.headers.slice(5)],
      rows: sheet.rows.map((r) => ({ ...r, cells: [...r.cells.slice(0, 5), '', ...r.cells.slice(5)] })),
    };
  const add = (row: number, col: number, message: string) => {
    col = historicSourceColumn(sourceHeaders, col);
    if (!errors.some((e) => e.row === row && e.column === col)) errors.push(historicIssue(row, col, message));
  };
  if (!sheet) {
    add(1, 1, `Missing worksheet: ${historicSheet}.`);
    return { records, errors };
  }
  historicColumns.forEach((header, i) => {
    if (i === 5) return; // Column F is a positional placeholder, never imported.
    if (sheet.headers[i]?.trim().toLowerCase() !== header.toLowerCase())
      add(
        1,
        i + 1,
        `Expected ${header} in column ${String.fromCharCode(64 + historicSourceColumn(sourceHeaders, i + 1))}.`,
      );
  });
  sheet.headers.slice(13).forEach((header, i) => {
    if (header || sheet.rows.some((r) => r.cells[i + 13]))
      add(1, i + 14, `Unexpected column; use exactly the ${compact ? 12 : 13} template columns.`);
  });
  for (const { row, cells } of sheet.rows) {
    cells.slice(13).forEach((value, i) => {
      if (value) add(row, i + 14, `Unexpected value outside the ${compact ? 12 : 13} template columns.`);
    });
    const v = Array.from({ length: 13 }, (_, i) => cells[i]?.trim() ?? '');
    for (const [i, max] of [
      [0, 160],
      [3, 100],
    ])
      if (!v[i] || v[i].length > max) add(row, i + 1, `Use a required text value of at most ${max} characters.`);
    if (!/^(19|20|21)\d{2}$/.test(v[1])) add(row, 2, 'Use a four-digit year from 1900 to 2199.');
    const month = /^(0?[1-9]|1[0-2])$/.test(v[2]) ? Number(v[2]) : months.indexOf(v[2].toLowerCase()) + 1;
    if (!month) add(row, 3, 'Use Jan–Dec or a month number from 1 to 12.');
    const fuel = fuels[v[4].toLowerCase()],
      unit = units[v[7].toLowerCase()];
    if (!fuel)
      add(row, 5, 'Use Grid Electricity, Solar PV, Gas, Diesel, Bio Diesel, Oil, Petrol, LPG, Biomass, Heat or Other.');
    if (!unit) add(row, 8, 'Use kWh, MWh, m3, litre (or l), or kg.');
    for (const i of [6, 8, 9, 10, 11, 12]) {
      if (!v[i] && [8, 9, 11, 12].includes(i)) continue;
      const precision = i === 10 ? 6 : 3;
      if (!new RegExp(`^\\d{1,10}(\\.\\d{1,${precision}})?$`).test(v[i]))
        add(row, i + 1, `Use a non-negative number with up to ${precision} decimal places.`);
    }
    if (v[8] && !v[9]) add(row, 10, 'Supply VAT Cost (use 0 when no VAT applies).');
    if (v[9] && !v[8]) add(row, 9, 'Supply Total Cost including VAT.');
    if (Number(v[9]) > Number(v[8])) add(row, 10, 'VAT Cost cannot exceed Total Cost.');
    if (!(Number(v[10]) > 0 && Number(v[10]) <= 100000))
      add(row, 11, 'Conversion Factor must be greater than 0 and at most 100000.');
    if (Number(v[12]) > 24) add(row, 13, 'Operating Hours must be between 0 and 24 hours per day.');
    if (!errors.some((e) => e.row === row))
      records.push({
        row,
        siteCode: v[0],
        month: `${v[1]}-${String(month).padStart(2, '0')}`,
        endUse: v[3],
        utility: v[4],
        fuel,
        quantity: v[6],
        unit,
        grossCost: v[8] || null,
        vatCost: v[9] || null,
        factor: v[10],
        population: v[11] || null,
        dailyHours: v[12] || null,
      });
  }
  if (!sheet.rows.length) add(2, 1, 'Include at least one consumption row.');
  return { records, errors };
}
