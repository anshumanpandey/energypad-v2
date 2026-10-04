import type { ImportSheet } from './sites';
import { historicIssue } from './historic-consumption';
import type { WorkbookCellIssue } from './workbook-errors';

export const emissionsSheet = 'Emissions';
export const emissionsColumns = ['Site Code', 'Year', 'Month', 'Utility Type', 'Fuel Unit', 'Emission Factor'];
export const compactEmissionsColumns = ['Site Name', 'Year', 'Month', 'Emission Factor'];
export const isCompactEmissions = (headers: readonly string[]) =>
  headers[3]?.trim().toLowerCase() === 'emission factor';
export const emissionCellIssue = (row: number, column: number, message: string): WorkbookCellIssue => ({
  ...historicIssue(row, column, message),
  sheet: emissionsSheet,
});
const fuels: Record<string, string> = {
  'grid electricity': 'ELECTRICITY',
  electricity: 'ELECTRICITY',
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
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function parseEmissions(sheet: ImportSheet | undefined, errors: WorkbookCellIssue[] = []) {
  const compact = isCompactEmissions(sheet?.headers ?? []);
  if (sheet && compact)
    sheet = {
      ...sheet,
      headers: [...sheet.headers.slice(0, 3), 'Utility Type', 'Fuel Unit', ...sheet.headers.slice(3)],
      rows: sheet.rows.map((r) => ({ ...r, cells: [...r.cells.slice(0, 3), 'ALL', 'kWh', ...r.cells.slice(3)] })),
    };
  const records: {
    row: number;
    siteCode: string;
    month: string;
    fuel: string;
    factor: string;
    zeroFilled?: boolean;
  }[] = [];
  const add = (row: number, column: number, message: string) => {
    if (compact && column >= 6) column -= 2;
    if (!errors.some((e) => e.row === row && e.column === column)) errors.push(emissionCellIssue(row, column, message));
  };
  if (!sheet) {
    add(1, 1, 'Missing worksheet: Emissions.');
    return { records, errors };
  }
  emissionsColumns.forEach((name, i) => {
    const header = sheet.headers[i]?.trim() ?? '';
    if (i === 0 && !header) return; // The supplied template intentionally leaves A1 blank.
    if (i === 0 && header.toLowerCase() === 'site name') return;
    if (header.toLowerCase() !== name.toLowerCase())
      add(1, i + 1, `Expected ${name} in column ${String.fromCharCode(65 + i)}.`);
  });
  sheet.headers.slice(6).forEach((value, i) => {
    if (value) add(1, i + 7, 'Unexpected column. Use the six template columns A–F.');
  });
  const seen = new Map<string, number>();
  for (const { row, cells } of sheet.rows) {
    cells.slice(6).forEach((value, i) => {
      if (value) add(row, i + 7, 'Unexpected value outside columns A–F.');
    });
    const v = Array.from({ length: 6 }, (_, i) => cells[i]?.trim() ?? '');
    if (!v[0] || v[0].length > 160)
      add(row, 1, 'An existing site name is required and must contain at most 160 characters.');
    if (!/^(19|20|21)\d{2}$/.test(v[1])) add(row, 2, 'Use a four-digit year from 1900 to 2199.');
    const month = /^(0?[1-9]|1[0-2])$/.test(v[2]) ? Number(v[2]) : months.indexOf(v[2].toLowerCase()) + 1;
    if (!month) add(row, 3, 'Use Jan–Dec or a month number from 1 to 12.');
    const fuel = compact ? 'ALL' : fuels[v[3].toLowerCase()];
    if (!fuel) add(row, 4, 'Use Grid Electricity, Solar PV, Gas, Diesel, Oil, Petrol, LPG, Biomass, Heat or Other.');
    if (v[4].toLowerCase() !== 'kwh') add(row, 5, 'Use kWh. Emission Factor must be expressed per kWh.');
    if (!/^\d{1,9}(\.\d{1,9})?$/.test(v[5])) add(row, 6, 'Use a non-negative factor with up to nine decimal places.');
    if (!errors.some((e) => e.row === row)) {
      const period = `${v[1]}-${String(month).padStart(2, '0')}`;
      const key = `${v[0].toLowerCase()}:${period}:${fuel}`;
      const previous = seen.get(key);
      if (previous !== undefined) {
        add(previous, 6, `Duplicate site, month and utility; also present on row ${row}.`);
        add(row, 6, `Duplicate site, month and utility; also present on row ${previous}.`);
      } else seen.set(key, row);
      records.push({ row, siteCode: v[0], month: period, fuel, factor: v[5] });
    }
  }
  if (!sheet.rows.length) add(2, 1, 'Include at least one emissions row.');
  return { records, errors };
}
