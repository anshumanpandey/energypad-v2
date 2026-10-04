import { Prisma, type ConsumptionRecord, type EmissionFactorVersion } from '@prisma/client';
import { expect, it } from 'vitest';
import { monthlyCarbonRows } from '../src/domain/carbon-monthly';
const reading = {
  id: 'reading',
  siteId: 'site',
  fuel: 'GAS',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-02-01'),
  normalizedKwh: new Prisma.Decimal(45),
  revision: 1,
} as ConsumptionRecord;
const factor = {
  id: 'site-factor',
  siteId: 'site',
  fuel: 'ALL',
  validFrom: reading.periodStart,
  validUntil: reading.periodEnd,
  factor: new Prisma.Decimal('0.5'),
  revision: 1,
} as EmissionFactorVersion;
it('applies a site-wide factor once and prefers a utility-specific factor', () => {
  expect(monthlyCarbonRows(2025, [reading], [factor])[0].kgCO2e).toBe('22.5');
  expect(
    monthlyCarbonRows(
      2025,
      [reading],
      [factor, { ...factor, id: 'gas-factor', fuel: 'GAS', factor: new Prisma.Decimal('0.2') }],
    )[0],
  ).toMatchObject({ factorId: 'gas-factor', kgCO2e: '9' });
  expect(monthlyCarbonRows(2025, [reading], [{ ...factor, siteId: 'other-site' }])[0].issue).not.toBeNull();
  expect(monthlyCarbonRows(2025, [reading], [factor, { ...factor, id: 'duplicate' }])[0].issue).not.toBeNull();
});
