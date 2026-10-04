import type { ImportSheet } from './sites';
import { historicIssue } from './historic-consumption';
import { monthlyAmount } from './monthly-plans';
import type { WorkbookCellIssue } from './workbook-errors';
export const targetColumns = [
  'Site Code',
  'Year',
  'Month',
  'Utility Type',
  'Fuel Unit',
  'Target Energy',
  'Target Carbon (Kg)',
];
export const targetIssue = (row: number, column: number, message: string): WorkbookCellIssue => ({
  ...historicIssue(row, column, message),
  sheet: 'Targets',
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
export const compactTargetColumns = ['Site Code', 'Year', 'Month', 'Target Energy', 'Target Carbon (Kg)'];
export const isCompactTargets = (headers: readonly string[]) => headers[3]?.trim().toLowerCase() === 'target energy';
export function parseTargets(sheet: ImportSheet | undefined, errors: WorkbookCellIssue[] = []) {
  const compact = isCompactTargets(sheet?.headers ?? []);
  if (sheet && compact)
    sheet = {
      ...sheet,
      headers: [...sheet.headers.slice(0, 3), 'Utility Type', 'Fuel Unit', ...sheet.headers.slice(3)],
      rows: sheet.rows.map((r) => ({ ...r, cells: [...r.cells.slice(0, 3), 'ALL', 'kWh', ...r.cells.slice(3)] })),
    };
  const records: {
    row: number;
    site: string;
    month: string;
    fuel: string;
    unit: string;
    energy: string;
    carbon: string;
    cost?: string;
    currency?: string;
    zeroFilled?: boolean;
  }[] = [];
  const add = (row: number, column: number, message: string) => {
    if (compact && column >= 6) column -= 2;
    if (!errors.some((e) => e.row === row && e.column === column)) errors.push(targetIssue(row, column, message));
  };
  if (!sheet) {
    add(1, 1, 'Missing worksheet: Targets.');
    return { records, errors };
  }
  targetColumns.forEach((name, i) => {
    if (sheet.headers[i]?.trim().toLowerCase() !== name.toLowerCase())
      add(1, i + 1, `Expected ${name} in column ${String.fromCharCode(65 + i)}.`);
  });
  sheet.headers.slice(7).forEach((v, i) => {
    if (v && v.trim().toLowerCase() !== ['target cost', 'currency'][i])
      add(1, i + 8, 'Optional columns are Target Cost and Currency.');
  });
  const seen = new Map<string, number>();
  for (const { row, cells } of sheet.rows) {
    const v = Array.from({ length: 7 }, (_, i) => cells[i]?.trim() ?? '');
    if (!v[0] || v[0].length > 160) add(row, 1, 'Enter an existing site name (at most 160 characters).');
    if (!/^(19|20|21)\d{2}$/.test(v[1])) add(row, 2, 'Use a year from 1900 to 2199.');
    const month = /^(0?[1-9]|1[0-2])$/.test(v[2]) ? Number(v[2]) : months.indexOf(v[2].toLowerCase()) + 1;
    if (!month) add(row, 3, 'Use Jan–Dec or a month number from 1 to 12.');
    const fuel = compact ? 'ALL' : fuels[v[3].toLowerCase()];
    if (!fuel) add(row, 4, 'Use Grid Electricity, Solar PV, Gas, Diesel, Oil, Petrol, LPG, Biomass, Heat or Other.');
    const unit = ({ kwh: 'kWh', mwh: 'MWh' } as Record<string, string>)[v[4].toLowerCase()];
    if (!unit) add(row, 5, 'Use kWh or MWh. This template has no conversion factor for other units.');
    for (const col of [6, 7])
      if (!monthlyAmount.safeParse(v[col - 1]).success)
        add(row, col, 'Enter a non-negative number with up to 15 digits and nine decimal places.');
    const cost = cells[7]?.trim() || undefined;
    const currency = cells[8]?.trim().toUpperCase() || undefined;
    if (cost && (sheet.headers[7]?.trim().toLowerCase() !== 'target cost' || !monthlyAmount.safeParse(cost).success))
      add(row, 8, 'Use the Target Cost header and a non-negative amount.');
    if (cost && sheet.headers[7]?.trim().toLowerCase() === 'target cost' && (!currency || !/^[A-Z]{3}$/.test(currency)))
      add(row, 9, 'Supply a three-letter currency for target cost.');
    if (currency && sheet.headers[8]?.trim().toLowerCase() !== 'currency') add(row, 9, 'Expected Currency header.');
    cells.slice(9).forEach((value, i) => {
      if (value) add(row, i + 10, 'Unexpected value after Currency.');
    });
    if (errors.some((e) => e.row === row)) continue;
    const period = `${v[1]}-${String(month).padStart(2, '0')}`;
    const key = `${v[0].toLowerCase()}:${period}:${fuel}:${unit}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      add(previous, 1, `Duplicate site/month/utility/unit on row ${row}.`);
      add(row, 1, `Duplicate site/month/utility/unit on row ${previous}.`);
    } else seen.set(key, row);
    records.push({
      row,
      site: v[0],
      month: period,
      fuel,
      unit,
      energy: v[5],
      carbon: v[6],
      ...(cost ? { cost, currency } : {}),
    });
  }
  if (!sheet.rows.length) add(2, 1, 'Include at least one target row.');
  return { records, errors };
}
