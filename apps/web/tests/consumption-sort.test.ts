import { describe, expect, it } from 'vitest';
import { sortConsumption } from '../src/domain/consumption-sort';

const rows = [
  {
    id: 'solar',
    meterId: 's',
    periodStart: '2020-02-01',
    fuel: 'SOLAR_PV',
    sourceQuantity: '100',
    normalizedKwh: '100',
    grossCost: null,
  },
  {
    id: 'old',
    meterId: 'o',
    periodStart: '2020-01-01',
    fuel: 'GAS',
    sourceQuantity: '2',
    normalizedKwh: '200',
    grossCost: '0',
  },
  {
    id: 'grid',
    meterId: 'e',
    periodStart: '2020-02-01',
    fuel: 'ELECTRICITY',
    sourceQuantity: '30',
    normalizedKwh: '30',
    grossCost: '20',
  },
  {
    id: 'gas',
    meterId: 'g',
    periodStart: '2020-02-01',
    fuel: 'GAS',
    sourceQuantity: '9',
    normalizedKwh: '90',
    grossCost: '100',
  },
];
describe('consumption table sorting', () => {
  it('defaults to newest month then displayed utility name without changing source data', () => {
    expect(sortConsumption(rows, { key: 'month', direction: 'desc' }).map((r) => r.id)).toEqual([
      'gas',
      'grid',
      'solar',
      'old',
    ]);
    expect(rows[0].id).toBe('solar');
    expect(sortConsumption(rows, { key: 'month', direction: 'asc' })[0].id).toBe('old');
    expect(sortConsumption(rows, { key: 'utility', direction: 'asc' }).map((r) => r.id)).toEqual([
      'gas',
      'old',
      'grid',
      'solar',
    ]);
  });
  it('sorts source and energy numerically rather than alphabetically', () => {
    expect(sortConsumption(rows, { key: 'source', direction: 'asc' }).map((r) => r.id)).toEqual([
      'old',
      'gas',
      'grid',
      'solar',
    ]);
    expect(sortConsumption(rows, { key: 'energy', direction: 'desc' }).map((r) => r.id)).toEqual([
      'old',
      'solar',
      'gas',
      'grid',
    ]);
  });
  it('sorts gross costs numerically with unknown costs last in both directions', () => {
    expect(sortConsumption(rows, { key: 'cost', direction: 'asc' }).map((r) => r.id)).toEqual([
      'old',
      'grid',
      'gas',
      'solar',
    ]);
    expect(sortConsumption(rows, { key: 'cost', direction: 'desc' }).map((r) => r.id)).toEqual([
      'gas',
      'grid',
      'old',
      'solar',
    ]);
  });
});
