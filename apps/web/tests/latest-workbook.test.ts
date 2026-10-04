import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { readWorkbook } from '../src/server/workbook';
import { historicSheet, historicIgnoredColumns, parseHistoric } from '../src/domain/historic-consumption';
import { parseEmissions } from '../src/domain/historic-emissions';
import { parseTargets } from '../src/domain/target-import';
import { parseClassifications } from '../src/domain/driver-classifications';
import type { WorkbookCellIssue } from '../src/domain/workbook-errors';

it('accepts the exact latest workbook and preserves all Heating and Cooling readings', async () => {
  const bytes = await readFile('public/templates/consumption-latest.xlsx');
  const errors: WorkbookCellIssue[] = [];
  const [historic] = await readWorkbook(bytes, {
    sheetName: historicSheet,
    cellErrors: errors,
    ignoredColumns: historicIgnoredColumns,
  });
  const consumption = parseHistoric(historic, errors);
  expect(consumption.errors).toEqual([]);
  expect(consumption.records).toHaveLength(192);
  expect(new Set(consumption.records.map((r) => `${r.siteCode}:${r.month}:${r.fuel}:${r.endUse}`)).size).toBe(192);
  const sheets = await readWorkbook(bytes);
  const emissions = parseEmissions(sheets.find((s) => s.name === 'Emissions'));
  expect(emissions.errors).toEqual([]);
  expect(emissions.records).toHaveLength(96);
  expect(emissions.records.every((r) => r.fuel === 'ALL')).toBe(true);
  const targets = parseTargets(sheets.find((s) => s.name === 'Targets'));
  expect(targets.errors).toEqual([]);
  expect(targets.records).toHaveLength(96);
  expect(targets.records[0]).toMatchObject({ fuel: 'ALL', unit: 'kWh', energy: '90', carbon: '90' });
  const driverErrors: WorkbookCellIssue[] = [];
  const [driverSheet] = await readWorkbook(bytes, { sheetName: 'Drivers', headerRow: 6, cellErrors: driverErrors });
  const drivers = parseClassifications(driverSheet, driverErrors);
  expect(drivers.errors).toEqual([]);
  expect(drivers.records).toHaveLength(8);
});

it('reports compact-sheet validation errors at their physical cells', () => {
  const emissions = parseEmissions({
    name: 'Emissions',
    headers: ['Site Name', 'Year', 'Month', 'Emission Factor'],
    rows: [{ row: 2, cells: ['London', '2025', 'Jan', '-1'] }],
  });
  expect(emissions.errors.map((e) => e.cell)).toEqual(['D2']);
  const targets = parseTargets({
    name: 'Targets',
    headers: ['Site Code', 'Year', 'Month', 'Target Energy', 'Target Carbon (Kg)'],
    rows: [{ row: 2, cells: ['London', '2025', 'Jan', '-1', '-2'] }],
  });
  expect(targets.errors.map((e) => e.cell)).toEqual(['D2', 'E2']);
});
