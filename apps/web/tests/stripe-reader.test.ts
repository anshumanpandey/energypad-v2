import { describe, it, expect, vi } from 'vitest';
import { StripeSubscriptionReader, stripeReadVersion } from '../src/server/stripe-reader';
const price = {
  id: 'price_fixture',
  object: 'price',
  livemode: false,
  currency: 'gbp',
  type: 'recurring',
  billing_scheme: 'per_unit',
  transform_quantity: null,
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
};
const subscription = {
  id: 'sub_fixture',
  object: 'subscription',
  customer: 'cus_fixture',
  livemode: false,
  status: 'active',
  items: { has_more: false, data: [{ quantity: 1, price }] },
};
const account = { id: 'acct_fixture', object: 'account' };
const input = { accountId: account.id, subscriptionId: subscription.id };
function setup(replies: unknown[] = [account, subscription, price]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const transport: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(replies.shift());
  };
  return { reader: new StripeSubscriptionReader('rk_test_fixture', account.id, transport), calls };
}
describe('Stripe test subscription reader', () => {
  it('retrieves account, subscription and price using GET-only pinned-version requests', async () => {
    const { reader, calls } = setup();
    expect(await reader.read(input)).toMatchObject({
      accountId: account.id,
      mode: 'test',
      status: 'active',
      price: { id: price.id, currency: 'gbp', interval: 'month' },
    });
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.stripe.com/v1/account',
      'https://api.stripe.com/v1/subscriptions/sub_fixture',
      'https://api.stripe.com/v1/prices/price_fixture',
    ]);
    for (const call of calls) {
      expect(call.init).toMatchObject({
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Stripe-Version': stripeReadVersion },
      });
      expect(call.init?.body).toBeUndefined();
    }
  });
  it('rejects live keys, account mismatches and path injection without network calls', async () => {
    expect(() => new StripeSubscriptionReader('sk_live_fixture', account.id)).toThrow();
    const { reader, calls } = setup();
    await expect(reader.read({ ...input, accountId: 'acct_other' })).rejects.toThrow();
    await expect(reader.read({ ...input, subscriptionId: '../customers' })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it.each([
    [{ ...account, id: 'acct_other' }, subscription, price],
    [account, { ...subscription, livemode: true }, price],
    [account, { ...subscription, id: 'sub_other' }, price],
    [account, { ...subscription, items: { ...subscription.items, has_more: true } }, price],
    [account, { ...subscription, items: { has_more: false, data: [] } }, price],
    [account, { ...subscription, items: { has_more: false, data: [{ quantity: 2, price }] } }, price],
    [account, subscription, { ...price, livemode: true }],
    [account, subscription, { ...price, id: 'price_other' }],
    [account, subscription, { ...price, currency: 'usd' }],
    [account, subscription, { ...price, recurring: { ...price.recurring, interval: 'week' } }],
    [account, subscription, { ...price, recurring: { ...price.recurring, usage_type: 'metered' } }],
    [account, subscription, { ...price, billing_scheme: 'tiered' }],
  ])('rejects unsupported or mismatched provider evidence %#', async (...replies) => {
    await expect(setup(replies).reader.read(input)).rejects.toThrow('Unable to verify Stripe subscription evidence.');
  });
  it.each([401, 429, 500])('sanitizes HTTP %i failures and never retries automatically', async (status) => {
    const transport = vi.fn<typeof fetch>(async () => new Response('private-provider-detail', { status }));
    await expect(new StripeSubscriptionReader('sk_test_fixture', account.id, transport).read(input)).rejects.toThrow(
      'Unable to verify Stripe subscription evidence.',
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('bounds responses regardless of Content-Length and rejects malformed JSON', async () => {
    for (const body of ['not-json', 'x'.repeat(1_000_001)]) {
      const transport: typeof fetch = async () => new Response(body, { headers: { 'Content-Length': '1' } });
      await expect(
        new StripeSubscriptionReader('sk_test_fixture', account.id, transport).read(input),
      ).rejects.toThrow();
    }
  });
  it('aborts stalled requests and sanitizes transport errors', async () => {
    vi.useFakeTimers();
    try {
      const transport: typeof fetch = async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('secret-detail')));
        });
      const result = new StripeSubscriptionReader('sk_test_fixture', account.id, transport).read(input);
      const assertion = expect(result).rejects.toThrow('Unable to verify Stripe subscription evidence.');
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
