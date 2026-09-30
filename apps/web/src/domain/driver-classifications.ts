import type { ImportSheet } from './sites';
import { historicIssue } from './historic-consumption';
import type { WorkbookCellIssue } from './workbook-errors';
export const classificationFields = [
  'heating',
  'cooling',
  'population',
  'operatingHours',
  'daylighting',
  'buildingSize',
] as const;
export const classificationColumns = [
  'Site',
  'Year',
  'Heating',
  'Cooling',
  'Population',
  'Operating Hours',
  'Daylighting',
  'Building Size',
];
export const classificationLabels = { R: 'Routine', NR: 'Non-routine', 'N/A': 'Not applicable' } as const;
export type ClassificationValues = Record<(typeof classificationFields)[number], keyof typeof classificationLabels>;
export type ClassificationRow = ClassificationValues & { row: number; site: string; year: number };
export const classificationIssue = (row: number, column: number, message: string): WorkbookCellIssue => ({
  ...historicIssue(row, column, message),
  sheet: 'Drivers',
});
export function parseClassifications(sheet: ImportSheet | undefined, errors: WorkbookCellIssue[] = []) {
  const records: ClassificationRow[] = [];
  const add = (row: number, col: number, message: string) => {
    if (!errors.some((e) => e.row === row && e.column === col)) errors.push(classificationIssue(row, col, message));
  };
  if (!sheet) {
    add(6, 1, 'Missing worksheet: Drivers.');
    return { records, errors };
  }
  classificationColumns.forEach((name, i) => {
    if (sheet.headers[i]?.trim().toLowerCase() !== name.toLowerCase())
      add(6, i + 1, `Expected ${name} in column ${String.fromCharCode(65 + i)} on row 6.`);
  });
  sheet.headers.slice(8).forEach((v, i) => {
    if (v) add(6, i + 9, 'Unexpected column outside A–H.');
  });
  const seen = new Map<string, number>();
  for (const { row, cells } of sheet.rows) {
    const v = Array.from({ length: 8 }, (_, i) => cells[i]?.trim() ?? '');
    if (!v[0] || v[0].length > 160) add(row, 1, 'Enter an existing site code or name (at most 160 characters).');
    if (!/^(19|20|21)\d{2}$/.test(v[1])) add(row, 2, 'Use a four-digit year from 1900 to 2199.');
    for (let i = 2; i < 8; i++) {
      v[i] = v[i].toUpperCase();
      if (!['R', 'NR', 'N/A'].includes(v[i]))
        add(row, i + 1, 'Use R (Routine), NR (Non-routine) or N/A (Not applicable).');
    }
    cells.slice(8).forEach((v, i) => {
      if (v) add(row, i + 9, 'Unexpected value outside columns A–H.');
    });
    if (!errors.some((e) => e.row === row)) {
      const key = `${v[0].toLowerCase()}:${v[1]}`;
      const previous = seen.get(key);
      if (previous !== undefined) {
        add(previous, 1, `Duplicate site/year on row ${row}.`);
        add(row, 1, `Duplicate site/year on row ${previous}.`);
      } else seen.set(key, row);
      records.push({
        row,
        site: v[0],
        year: Number(v[1]),
        ...(Object.fromEntries(classificationFields.map((field, i) => [field, v[i + 2]])) as ClassificationValues),
      });
    }
  }
  if (!sheet.rows.length) add(7, 1, 'Include at least one driver classification row below the headers.');
  return { records, errors };
}
