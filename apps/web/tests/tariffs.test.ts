import { describe, it, expect } from 'vitest';
import { tariffInput, energyUseInput } from '../src/domain/tariffs';
const band = { name: 'Day', days: [1], startTime: '00:00', endTime: '12:00', rate: '0', legacyId: '' };
const tariff = {
  energyUseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Test',
  firstDay: '2020-01-01',
  lastDay: '2020-12-31',
  currency: 'gbp',
  rateUnit: 'kWh',
  taxBasis: 'NET',
  vatPercent: '20',
  timezone: 'Europe/London',
  source: 'Synthetic test',
  bands: [band],
};
describe('explicit tariff semantics', () => {
  it('preserves zero, normalizes currency and accepts adjacent bands', () => {
    expect(tariffInput.parse(tariff).currency).toBe('GBP');
    expect(tariffInput.parse(tariff).bands[0].rate).toBe('0');
    expect(
      tariffInput.safeParse({ ...tariff, bands: [band, { ...band, startTime: '12:00', endTime: '24:00' }] }).success,
    ).toBe(true);
  });
  it('rejects duplicate days, overlaps, overnight ambiguity and missing semantics', () => {
    for (const bands of [
      [band, band],
      [{ ...band, days: [1, 1] }],
      [{ ...band, startTime: '23:00', endTime: '01:00' }],
      [{ ...band, days: [] }],
      [{ ...band, rate: '-1' }],
    ])
      expect(tariffInput.safeParse({ ...tariff, bands }).success).toBe(false);
    for (const patch of [
      { taxBasis: '' },
      { rateUnit: '' },
      { vatPercent: '101' },
      { timezone: 'Invalid/Zone' },
      { lastDay: '2020-02-30' },
      { pricingLegacyId: '123' },
    ])
      expect(tariffInput.safeParse({ ...tariff, ...patch }).success).toBe(false);
  });
  it('requires namespaced source associations and permits case-insensitive codes', () => {
    const use = { code: 'lighting', name: 'Lighting', fuel: 'ELECTRICITY', source: 'Test source' };
    expect(energyUseInput.parse(use).code).toBe('LIGHTING');
    expect(energyUseInput.safeParse({ ...use, associationLegacyId: '1' }).success).toBe(false);
    expect(
      energyUseInput.safeParse({
        ...use,
        legacySource: 'root',
        associationLegacyId: '1',
        associationLegacyTable: 'BusinessFuelUses',
      }).success,
    ).toBe(true);
  });
});
