import { describe, expect, it } from 'vitest';
import { inventoryQuery } from '../src/domain/import-inventory';

describe('import inventory cutoff', () => {
  it('normalizes an explicit timezone to UTC', () => {
    expect(inventoryQuery(new URLSearchParams({ before: '2026-01-01T02:00:00+02:00' })).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
  it.each([
    '',
    'before=2026-01-01',
    'before=2026-01-01T00:00:00',
    'before=2026-02-30T00:00:00Z',
    'before=bad',
    'before=2026-01-01T00:00:00Z&before=2026-01-02T00:00:00Z',
    'before=2026-01-01T00:00:00Z&organisationId=other',
  ])('rejects malformed or ambiguous query %s', (query) => {
    expect(() => inventoryQuery(new URLSearchParams(query))).toThrow();
  });
});

import { inventoryExportQuery } from '../src/domain/import-inventory';
describe('inventory export query', () => {
  const valid = `before=2020-01-01T00:00:00Z&fingerprint=${'a'.repeat(64)}`;
  it('requires exact evidence and cutoff', () => {
    expect(inventoryExportQuery(new URLSearchParams(valid))).toEqual({
      before: '2020-01-01T00:00:00.000Z',
      fingerprint: 'a'.repeat(64),
    });
  });
  it.each([
    '',
    'before=2020-01-01T00:00:00Z',
    valid + '&fingerprint=' + 'b'.repeat(64),
    valid + '&before=2020-01-02T00:00:00Z',
    valid + '&format=csv',
    valid.replace('a'.repeat(64), 'bad'),
  ])('rejects %s', (value) => {
    expect(() => inventoryExportQuery(new URLSearchParams(value))).toThrow();
  });
});

import { inventoryReviewQuery } from '../src/domain/import-inventory';
describe('inconsistent batch query', () => {
  it('accepts a category and optional scoped cursor', () => {
    expect(inventoryReviewQuery(new URLSearchParams('category=sites'))).toEqual({ category: 'sites' });
  });
  it.each([
    '',
    'category=unknown',
    'category=sites&category=energy',
    'category=sites&cursor=bad',
    'category=sites&before=2020-01-01',
  ])('rejects %s', (value) => {
    expect(() => inventoryReviewQuery(new URLSearchParams(value))).toThrow();
  });
});
