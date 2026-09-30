import { expect, it } from 'vitest';
import { parseClassifications, classificationColumns } from '../src/domain/driver-classifications';
const row = ['London', '2024', 'R', 'NR', 'NR', 'N/A', 'N/A', 'N/A'];
const sheet = (rows: string[][], headers = classificationColumns) => ({
  name: 'Drivers',
  headers,
  rows: rows.map((cells, i) => ({ row: i + 7, cells })),
});
it('parses annual categories and tolerates header whitespace and blank formatting columns', () => {
  const parsed = parseClassifications(sheet([row], [...classificationColumns.map((h) => ` ${h} `), '', '']));
  expect(parsed.errors).toEqual([]);
  expect(parsed.records[0]).toMatchObject({
    site: 'London',
    year: 2024,
    heating: 'R',
    cooling: 'NR',
    buildingSize: 'N/A',
  });
});
it('reports every incorrect category and preserves row 7 cell addresses', () => {
  expect(
    parseClassifications(sheet([['', 'bad', '', 'unknown', '0', '#N/A', 'routine', '-1']])).errors.map((e) => e.cell),
  ).toEqual(['A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7']);
});
it('rejects moved headers and extra populated columns', () => {
  expect(
    parseClassifications(sheet([[...row, 'extra']], ['Wrong', ...classificationColumns.slice(1), 'Extra'])).errors.map(
      (e) => e.cell,
    ),
  ).toEqual(['A6', 'I6', 'I7']);
});
it('flags both duplicate rows and missing worksheets', () => {
  expect(parseClassifications(sheet([row, row])).errors.map((e) => e.cell)).toEqual(['A7', 'A8']);
  expect(parseClassifications(undefined).errors[0].cell).toBe('A6');
});
