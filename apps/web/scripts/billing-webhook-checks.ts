import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { StripeWebhookReceipts } from '../src/server/stripe-webhooks';
export async function checkWebhookReceipts(db: PrismaClient) {
  const secret = 'whsec_fixture';
  const service = new StripeWebhookReceipts(db, secret, 'acct_fixture');
  const event = {
    id: 'evt_fixture',
    object: 'event',
    livemode: false,
    type: 'customer.subscription.updated',
    created: 1,
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
  const submit = (value: unknown) => {
    const body = Buffer.from(JSON.stringify(value));
    const t = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex');
    return service.receive(body, `t=${t},v1=${signature}`);
  };
  await assert.rejects(service.receive(Buffer.from(JSON.stringify(event)), 'invalid'));
  assert.equal(await db.billingWebhookReceipt.count(), 0);
  const pair = await Promise.all([submit(event), submit(event)]);
  assert.equal(pair[0].id, pair[1].id);
  assert.equal(await db.billingWebhookReceipt.count(), 1);
  await assert.rejects(submit({ ...event, created: 2 }), { code: 'BILLING_EVENT_CONFLICT' });
  await submit({ ...event, id: 'evt_older', created: 0 });
  assert.equal(await db.billingWebhookReceipt.count(), 2);
  assert.equal((await submit(event)).id, pair[0].id);
  await assert.rejects(db.billingWebhookReceipt.update({ where: { id: pair[0].id }, data: { eventType: 'rewrite' } }));
  await assert.rejects(db.billingWebhookReceipt.delete({ where: { id: pair[0].id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE TABLE "BillingWebhookReceipt"'));
  console.log(
    '✓ signed durable receipts, concurrent deduplication, conflicting payload rejection, out-of-order retention and immutable evidence',
  );
}
