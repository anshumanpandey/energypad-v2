import { z } from 'zod';
import { DomainError } from '../domain/policy';
import type { SubscriptionReader, SubscriptionSnapshot } from './billing-ingestion';
const id = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`))
    .max(255);
const priceSchema = z.object({
  id: id('price'),
  object: z.literal('price'),
  livemode: z.literal(false),
  currency: z.string().regex(/^[a-z]{3}$/),
  type: z.literal('recurring'),
  billing_scheme: z.literal('per_unit'),
  transform_quantity: z.null(),
  recurring: z.object({
    interval: z.enum(['month', 'year']),
    interval_count: z.literal(1),
    usage_type: z.literal('licensed'),
  }),
});
const subscriptionSchema = z.object({
  id: id('sub'),
  object: z.literal('subscription'),
  customer: id('cus'),
  livemode: z.literal(false),
  status: z.enum([
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]),
  items: z.object({
    has_more: z.literal(false),
    data: z.array(z.object({ quantity: z.literal(1), price: priceSchema })).length(1),
  }),
});
export const stripeReadVersion = '2024-06-20';
const unavailable = () =>
  new DomainError('BILLING_PROVIDER_UNAVAILABLE', 'Unable to verify Stripe subscription evidence.', 503);

// GET-only test-mode adapter. No environment auto-activation, checkout, or Connect impersonation.
export class StripeSubscriptionReader implements SubscriptionReader {
  constructor(
    private key: string,
    private accountId: string,
    private transport: typeof fetch = fetch,
  ) {
    if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key) || !id('acct').safeParse(accountId).success)
      throw new DomainError('BILLING_CONFIGURATION', 'Use a test-mode Stripe key and account ID.', 503);
  }
  private async get(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.transport(`https://api.stripe.com/v1/${path}`, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.key}`, 'Stripe-Version': stripeReadVersion },
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw unavailable();
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_000_000) {
            await reader.cancel();
            throw unavailable();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }
  async read(input: { accountId: string; subscriptionId: string }): Promise<SubscriptionSnapshot> {
    if (input.accountId !== this.accountId || !id('sub').safeParse(input.subscriptionId).success)
      throw new DomainError('BILLING_PROVIDER_SCOPE', 'Stripe account or subscription identity does not match.', 409);
    try {
      // No Stripe-Account header: verify the account actually owned by this key.
      const account = z.object({ id: id('acct'), object: z.literal('account') }).parse(await this.get('account'));
      if (account.id !== this.accountId) throw unavailable();
      const subscription = subscriptionSchema.parse(await this.get(`subscriptions/${input.subscriptionId}`));
      if (subscription.id !== input.subscriptionId) throw unavailable();
      const item = subscription.items.data[0];
      const price = priceSchema.parse(await this.get(`prices/${item.price.id}`));
      if (
        price.id !== item.price.id ||
        price.currency !== item.price.currency ||
        price.recurring.interval !== item.price.recurring.interval
      )
        throw unavailable();
      return {
        accountId: account.id,
        mode: 'test',
        customerId: subscription.customer,
        subscriptionId: subscription.id,
        status: subscription.status,
        price: {
          id: price.id,
          accountId: account.id,
          mode: 'test',
          currency: price.currency,
          interval: price.recurring.interval,
          intervalCount: 1,
          quantity: 1,
        },
      };
    } catch {
      throw unavailable();
    }
  }
}
