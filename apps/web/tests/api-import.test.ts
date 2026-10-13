import { expect, it } from 'vitest';
import {
  apiImportExample,
  apiImportPayload,
  apiImportSettings,
  apiDatasets,
  datasetPayload,
} from '../src/domain/api-import';
import { apiImportWorkbook } from '../src/server/api-import-workbook';
import { readWorkbook } from '../src/server/workbook';
import { parseHistoric } from '../src/domain/historic-consumption';
import { parseEmissions } from '../src/domain/historic-emissions';
import { parseTargets } from '../src/domain/target-import';
import { parseClassifications } from '../src/domain/driver-classifications';

it('converts the documented JSON example without losing values through all four existing validators', async () => {
  const bytes = await apiImportWorkbook(apiImportExample);
  const sheets = await readWorkbook(bytes);
  const consumption = parseHistoric(sheets.find((s) => s.name === 'Historic Consumption'));
  expect(consumption.errors).toEqual([]);
  expect(consumption.records[0]).toMatchObject({
    month: '2025-01',
    quantity: '1250',
    grossCost: '150',
    dailyHours: '8',
  });
  for (const [name, parse] of [
    ['Emissions', parseEmissions],
    ['Targets', parseTargets],
  ] as const) {
    const result = parse(sheets.find((s) => s.name === name));
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(1);
  }
  const drivers = await readWorkbook(bytes, { sheetName: 'Drivers', headerRow: 6, cellErrors: [] });
  expect(parseClassifications(drivers[0]).errors).toEqual([]);
  expect(parseClassifications(drivers[0]).records[0]).toMatchObject({ heating: 'R', buildingSize: 'NR' });
});
it('reports every malformed JSON field and rejects extra fields and formatted numbers', () => {
  const data = structuredClone(apiImportExample);
  Object.assign(data.consumption[0], { month: 13, consumption: '1,250', extra: 'unexpected' });
  const result = apiImportPayload.safeParse(data);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['consumption.0.month', 'consumption.0.consumption', 'consumption.0']),
    );
});
it('permits clearing saved URL but rejects unsafe schemes and embedded credentials', () => {
  for (const url of [
    '',
    'https://provider.example/data?site=abc',
    'http://provider.example/data',
    'http://localhost:3002/data',
  ])
    expect(apiImportSettings.safeParse({ url }).success).toBe(true);
  for (const url of [
    'ftp://provider.example/data',
    'http://user:pass@example.test/data',
    'javascript:alert(1)',
    'https://user:pass@example.test/data',
    'https://example.test/#secret',
  ])
    expect(apiImportSettings.safeParse({ url }).success).toBe(false);
});

it.each(apiDatasets)('accepts %s alone and requires its records', async (dataset) => {
  const input = { version: 1, [dataset]: apiImportExample[dataset] };
  expect(datasetPayload(dataset).safeParse(input).success).toBe(true);
  expect(datasetPayload(dataset).safeParse({ version: 1 }).success).toBe(false);
  const bytes = await apiImportWorkbook(input, dataset);
  expect(bytes.length).toBeGreaterThan(0);
});
