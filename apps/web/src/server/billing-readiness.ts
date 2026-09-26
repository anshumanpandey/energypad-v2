import { parseBillingCatalogue } from './billing-catalogue';

type Check = { name: string; status: 'MISSING' | 'INVALID' | 'VALID' | 'DISABLED' };
// Local syntax/configuration inspection only. Never include environment values in output.
export function billingReadiness(env: Record<string, string | undefined>) {
  const checks: Check[] = [];
  const field = (name: string, pattern: RegExp) => {
    const value = env[name];
    checks.push({ name, status: !value?.trim() ? 'MISSING' : pattern.test(value) ? 'VALID' : 'INVALID' });
  };
  field('STRIPE_TEST_SECRET_KEY', /^(sk|rk)_test_[A-Za-z0-9]+$/);
  field('STRIPE_TEST_ACCOUNT_ID', /^acct_[A-Za-z0-9]{1,250}$/);
  field('STRIPE_TEST_WEBHOOK_SECRET', /^whsec_[A-Za-z0-9]+$/);
  let catalogue: ReturnType<typeof parseBillingCatalogue> = null;
  try {
    catalogue = parseBillingCatalogue(env.BILLING_PRICE_CATALOGUE);
    checks.push({ name: 'BILLING_PRICE_CATALOGUE', status: catalogue ? 'VALID' : 'MISSING' });
  } catch {
    checks.push({ name: 'BILLING_PRICE_CATALOGUE', status: 'INVALID' });
  }
  const flag = env.STRIPE_WEBHOOK_RECEIPTS_ENABLED;
  checks.push({
    name: 'STRIPE_WEBHOOK_RECEIPTS_ENABLED',
    status: flag === 'true' ? 'VALID' : !flag || flag === 'false' ? 'DISABLED' : 'INVALID',
  });
  const readNames = ['STRIPE_TEST_SECRET_KEY', 'STRIPE_TEST_ACCOUNT_ID', 'BILLING_PRICE_CATALOGUE'];
  return {
    version: 'billing-configuration-check-v1',
    checks,
    readConfiguration: checks.filter((c) => readNames.includes(c.name)).every((c) => c.status === 'VALID')
      ? 'COMPLETE'
      : 'BLOCKED',
    webhookConfiguration: checks
      .filter((c) =>
        ['STRIPE_TEST_ACCOUNT_ID', 'STRIPE_TEST_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_RECEIPTS_ENABLED'].includes(c.name),
      )
      .every((c) => c.status === 'VALID')
      ? 'COMPLETE'
      : 'BLOCKED',
    catalogue: catalogue ? { fingerprint: catalogue.fingerprint, mappings: catalogue.prices.length } : null,
    providerVerification: 'NOT_RUN',
    databaseMigrations: 'NOT_CHECKED',
    reviewedWorkspaceBinding: 'NOT_CHECKED',
    signedDeliveryAcceptance: 'NOT_RUN',
    commercialPolicyApproval: 'NOT_CHECKED',
    paymentActivation: 'DISABLED',
  } as const;
}
