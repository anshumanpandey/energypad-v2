import { describe, it, expect } from 'vitest';
import { parseBillingCatalogue, resolveBillingPrice } from '../src/server/billing-catalogue';

const price = { priceId: 'price_testFixture', planKey: 'GROWTH', currency: 'gbp', interval: 'month' };
const config = { version: 'test-v1', mode: 'test', prices: [price] };
const parse = (value: unknown) => parseBillingCatalogue(JSON.stringify(value));
describe('server billing catalogue', () => {
  it('stays unconfigured without approved mappings', () => {
    expect(parseBillingCatalogue(undefined)).toBeNull();
    expect(parseBillingCatalogue('  ')).toBeNull();
    expect(() => resolveBillingPrice(null, price.priceId)).toThrow(/not configured/);
  });
  it('resolves exact IDs with catalogue identity and rejects unmapped IDs', () => {
    const catalogue = parse(config)!;
    expect(resolveBillingPrice(catalogue, price.priceId)).toEqual({
      ...price,
      catalogueVersion: 'test-v1',
      catalogueFingerprint: catalogue.fingerprint,
    });
    expect(() => resolveBillingPrice(catalogue, 'price_unknown')).toThrow(/not mapped/);
    expect(Object.isFrozen(catalogue.prices[0])).toBe(true);
  });
  it('fingerprints mapping changes independently of input order', () => {
    const annual = { ...price, priceId: 'price_annualFixture', interval: 'year' };
    const a = parse({ ...config, prices: [price, annual] })!;
    const b = parse({ ...config, prices: [annual, price] })!;
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(parse({ ...config, prices: [{ ...price, planKey: 'STARTER' }] })!.fingerprint).not.toBe(
      parse(config)!.fingerprint,
    );
  });
  it.each([
    { ...config, mode: 'live' },
    { ...config, version: '' },
    { ...config, prices: [] },
    { ...config, prices: [price, price] },
    { ...config, prices: [price, { ...price, priceId: 'price_duplicateOffer' }] },
    { ...config, prices: [price, { ...price, interval: 'year' }] },
    ...[
      { planKey: 'UNKNOWN' },
      { currency: 'GBP' },
      { interval: 'week' },
      { priceId: 'untrusted' },
      { entitlement: 'ENTERPRISE' },
    ].map((change) => ({ ...config, prices: [{ ...price, ...change }] })),
    { ...config, secret: 'do-not-echo' },
  ])('rejects invalid or ambiguous configuration %#', (value) => {
    expect(() => parse(value)).toThrow('Billing price catalogue configuration is invalid.');
  });
  it('bounds configuration and never echoes invalid contents', () => {
    for (const value of ['secret-invalid-json', 'x'.repeat(32769), 'null'])
      expect(() => parseBillingCatalogue(value)).toThrow('Billing price catalogue configuration is invalid.');
  });
});
