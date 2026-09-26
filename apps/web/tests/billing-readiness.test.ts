import { describe, it, expect } from 'vitest';
import { billingReadiness } from '../src/server/billing-readiness';
const configured = {
  STRIPE_TEST_SECRET_KEY: 'rk_test_sensitive',
  STRIPE_TEST_ACCOUNT_ID: 'acct_sensitive',
  STRIPE_TEST_WEBHOOK_SECRET: 'whsec_sensitive',
  STRIPE_WEBHOOK_RECEIPTS_ENABLED: 'true',
  BILLING_PRICE_CATALOGUE: JSON.stringify({
    version: 'privateVersion',
    mode: 'test',
    prices: [{ priceId: 'price_sensitive', planKey: 'GROWTH', currency: 'gbp', interval: 'month' }],
  }),
};
describe('billing configuration readiness', () => {
  it('identifies missing configuration without mistaking a disabled endpoint for readiness', () => {
    const result = billingReadiness({});
    expect(result.readConfiguration).toBe('BLOCKED');
    expect(result.webhookConfiguration).toBe('BLOCKED');
    expect(result.checks.filter((c) => c.status === 'MISSING')).toHaveLength(4);
  });
  it('distinguishes syntax readiness from provider, database and business approval', () => {
    const result = billingReadiness(configured);
    expect(result.readConfiguration).toBe('COMPLETE');
    expect(result.webhookConfiguration).toBe('COMPLETE');
    expect(result).toMatchObject({
      providerVerification: 'NOT_RUN',
      databaseMigrations: 'NOT_CHECKED',
      reviewedWorkspaceBinding: 'NOT_CHECKED',
      signedDeliveryAcceptance: 'NOT_RUN',
      commercialPolicyApproval: 'NOT_CHECKED',
      paymentActivation: 'DISABLED',
    });
    const output = JSON.stringify(result);
    for (const value of Object.values(configured)) expect(output).not.toContain(value);
  });
  it('permits read preparation while webhook remains intentionally disabled', () => {
    const result = billingReadiness({ ...configured, STRIPE_WEBHOOK_RECEIPTS_ENABLED: 'false' });
    expect(result.readConfiguration).toBe('COMPLETE');
    expect(result.webhookConfiguration).toBe('BLOCKED');
  });
  it.each([
    ['STRIPE_TEST_SECRET_KEY', 'sk_live_private'],
    ['STRIPE_TEST_ACCOUNT_ID', '../wrong'],
    ['STRIPE_TEST_WEBHOOK_SECRET', 'private-secret'],
    ['STRIPE_WEBHOOK_RECEIPTS_ENABLED', 'TRUE'],
    ['BILLING_PRICE_CATALOGUE', '{private-malformed'],
  ])('rejects invalid %s without leaking its value', (name, value) => {
    const result = billingReadiness({ ...configured, [name]: value });
    expect(result.checks.find((c) => c.name === name)?.status).toBe('INVALID');
    expect(JSON.stringify(result)).not.toContain(value);
  });
});
