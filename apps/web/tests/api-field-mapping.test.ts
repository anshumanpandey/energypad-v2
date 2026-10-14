import { expect, it } from 'vitest';
import { defaultFieldMapping, mapApiResponse, validateFieldMapping } from '../src/domain/api-field-mapping';
import { apiImportExample } from '../src/domain/api-import';

it('maps nested custom fields and plain decimal strings into validated target records', () => {
  const mapping = {
    ...defaultFieldMapping('targets'),
    enabled: true,
    recordsPath: 'data.rows',
    fields: {
      site: 'building.name',
      year: 'period.year',
      month: 'period.month',
      energy: 'usage_goal',
      carbon: 'co2_goal',
    },
  };
  const input = {
    data: {
      rows: [
        {
          building: { name: 'Office' },
          period: { year: '2025', month: '01' },
          usage_goal: '1200.25',
          co2_goal: '200',
          ignored: 'metadata',
        },
      ],
    },
  };
  expect(mapApiResponse('targets', input, mapping).targets).toEqual([
    { site: 'Office', year: 2025, month: 1, energy: 1200.25, carbon: 200 },
  ]);
});
it('supports arrays at the response root and optional unknown fields without inventing zero values', () => {
  const row = { ...apiImportExample.consumption[0] };
  const result = mapApiResponse('consumption', [row], {
    enabled: true,
    recordsPath: '',
    fields: { population: '', operatingHours: '' },
  });
  expect(result.consumption?.[0]).toMatchObject({ population: null, operatingHours: null, consumption: 1250 });
});
it('keeps the standard response compatible when mapping is disabled', () => {
  expect(mapApiResponse('emissions', apiImportExample, defaultFieldMapping('emissions')).emissions).toEqual(
    apiImportExample.emissions,
  );
});
it('reports all invalid destinations and rejects formatted numbers and missing required source fields', () => {
  expect(() =>
    mapApiResponse(
      'targets',
      { rows: [{ year: '2025', month: 13, energy: '1,200', carbon: -1 }] },
      { enabled: true, recordsPath: 'rows', fields: {} },
    ),
  ).toThrow(/targets.0.site/);
  try {
    mapApiResponse(
      'targets',
      { rows: [{ year: 2025, month: 13, energy: '1,200', carbon: -1 }] },
      { enabled: true, recordsPath: 'rows', fields: {} },
    );
  } catch (error) {
    expect(String(error)).toContain('targets.0.energy');
    expect(String(error)).toContain('targets.0.carbon');
  }
  expect(() => mapApiResponse('targets', { rows: {} }, { enabled: true, recordsPath: 'rows', fields: {} })).toThrow(
    'must contain an array',
  );
});
it('rejects invalid mappings and does not traverse inherited properties', () => {
  for (const config of [
    { enabled: true, recordsPath: '__proto__.rows', fields: {} },
    { enabled: true, recordsPath: 'rows', fields: { other: 'x' } },
    { enabled: true, recordsPath: 'rows', fields: { site: '' } },
  ])
    expect(() => validateFieldMapping('targets', config)).toThrow();
  expect(() =>
    mapApiResponse('targets', Object.create({ rows: [] }), { enabled: true, recordsPath: 'rows', fields: {} }),
  ).toThrow('must contain an array');
});
