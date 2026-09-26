import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { verifyStripeEvent, webhookResponse, webhookBodyLimit } from '../src/server/stripe-webhooks';
const secret = 'whsec_fixture';
const time = 1800000000;
const event = {
  id: 'evt_fixture',
  object: 'event',
  type: 'customer.subscription.updated',
  livemode: false,
  created: time - 9999,
  data: {
    object: {
      id: 'sub_fixture',
      object: 'subscription',
      customer: 'cus_fixture',
      livemode: false,
      metadata: { organisationId: 'untrusted' },
    },
  },
};
const raw = Buffer.from(JSON.stringify(event));
const sign = (body = raw, t = time) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex')}`;
describe('Stripe signature verification', () => {
  it('verifies raw bytes while preserving event time separately from delivery time', () => {
    expect(verifyStripeEvent(raw, sign(), secret, 'acct_fixture', time * 1000)).toMatchObject({
      providerEventId: 'evt_fixture',
      providerSubscriptionId: 'sub_fixture',
      providerCustomerId: 'cus_fixture',
    });
    expect(
      verifyStripeEvent(raw, `v1=${'0'.repeat(64)},${sign()}`, secret, 'acct_fixture', time * 1000).providerEventId,
    ).toBe('evt_fixture');
  });
  it.each([
    null,
    '',
    't=wrong,v1=bad',
    `t=${time},v0=${'a'.repeat(64)}`,
    `${sign()},t=${time}`,
    sign(raw, time - 301),
    sign(raw, time + 301),
  ])('rejects malformed, stale or future signatures %#', (header) => {
    expect(() => verifyStripeEvent(raw, header, secret, 'acct_fixture', time * 1000)).toThrow();
  });
  it('accepts the inclusive five-minute boundary and rejects altered payloads', () => {
    expect(() => verifyStripeEvent(raw, sign(raw, time - 300), secret, 'acct_fixture', time * 1000)).not.toThrow();
    expect(() =>
      verifyStripeEvent(Buffer.concat([raw, Buffer.from(' ')]), sign(), secret, 'acct_fixture', time * 1000),
    ).toThrow();
    expect(() => verifyStripeEvent(raw, sign(), 'whsec_other', 'acct_fixture', time * 1000)).toThrow();
  });
  it.each([
    { ...event, livemode: true },
    { ...event, account: 'acct_other' },
    { ...event, data: { object: { ...event.data.object, livemode: true } } },
    { ...event, data: { object: { ...event.data.object, customer: 'invalid' } } },
  ])('rejects live, Connect or malformed routing %#', (value) => {
    const body = Buffer.from(JSON.stringify(value));
    expect(() => verifyStripeEvent(body, sign(body), secret, 'acct_fixture', time * 1000)).toThrow();
  });
  it('retains unsupported event identity without inventing subscription routing', () => {
    const body = Buffer.from(JSON.stringify({ ...event, type: 'invoice.paid' }));
    expect(verifyStripeEvent(body, sign(body), secret, 'acct_fixture', time * 1000).providerSubscriptionId).toBeNull();
  });
});
describe('receipt endpoint transport', () => {
  it('remains disabled without configuration', async () => {
    expect((await webhookResponse(new Request('http://localhost'), null)).status).toBe(503);
  });
  it('acknowledges only durable receipt and forwards exact signed bytes without session auth', async () => {
    const receive = vi.fn().mockResolvedValue({});
    const response = await webhookResponse(
      new Request('http://localhost', { method: 'POST', body: raw, headers: { 'Stripe-Signature': sign() } }),
      { receive },
    );
    expect(response.status).toBe(200);
    expect(receive).toHaveBeenCalledWith(raw, sign());
    expect(await response.json()).toEqual({ received: true });
  });
  it('returns retryable failure without reflecting database or secret details', async () => {
    const response = await webhookResponse(new Request('http://localhost', { method: 'POST', body: raw }), {
      receive: async () => {
        throw new Error('secret database detail');
      },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret');
  });
  it('rejects streamed overflow despite a false Content-Length', async () => {
    const receive = vi.fn();
    const response = await webhookResponse(
      new Request('http://localhost', {
        method: 'POST',
        body: 'x'.repeat(webhookBodyLimit + 1),
        headers: { 'Content-Length': '1' },
      }),
      { receive },
    );
    expect(response.status).toBe(413);
    expect(receive).not.toHaveBeenCalled();
  });
});
