import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { actorFor } from '../src/server/foundation';
import { BillingReconciliationWorker } from '../src/server/billing-reconciliation';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';
import type { SubscriptionReader, SubscriptionSnapshot } from '../src/server/billing-ingestion';
export async function checkBillingWorker(db: PrismaClient) {
  const org = await db.organisation.create({ data: { name: 'Worker test', slug: crypto.randomUUID() } });
  const user = await db.user.create({ data: { email: 'worker-owner@example.test', emailVerified: new Date() } });
  const actor = actorFor(user.id);
  await db.membership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER' } });
  const customer = await db.billingCustomer.create({
    data: { organisationId: org.id, providerAccountId: 'acct_worker', mode: 'test', providerCustomerId: 'cus_worker' },
  });
  const subscription = await db.billingSubscription.create({
    data: {
      organisationId: org.id,
      customerId: customer.id,
      providerAccountId: 'acct_worker',
      mode: 'test',
      providerSubscriptionId: 'sub_worker',
    },
  });
  const receipt = (id: string, customerId = 'cus_worker') =>
    db.billingWebhookReceipt.create({
      data: {
        providerAccountId: 'acct_worker',
        mode: 'test',
        providerEventId: `evt_${id}`,
        eventType: 'customer.subscription.updated',
        providerCustomerId: customerId,
        providerSubscriptionId: 'sub_worker',
        providerCreatedAt: new Date(0),
        payloadHash: 'a'.repeat(64),
      },
    });
  const catalogue = parseBillingCatalogue(
    JSON.stringify({
      version: 'fixture-v1',
      mode: 'test',
      prices: [{ priceId: 'price_worker', planKey: 'GROWTH', currency: 'gbp', interval: 'month' }],
    }),
  );
  const state: SubscriptionSnapshot = {
    accountId: 'acct_worker',
    mode: 'test',
    customerId: 'cus_worker',
    subscriptionId: 'sub_worker',
    status: 'active',
    price: {
      id: 'price_worker',
      currency: 'gbp',
      interval: 'month',
      intervalCount: 1,
      quantity: 1,
      mode: 'test',
      accountId: 'acct_worker',
    },
  };
  let calls = 0;
  const make = (read: SubscriptionReader['read']) =>
    new BillingReconciliationWorker(db, { async send() {} }, 'http://localhost', catalogue, { read });
  const worker = make(async () => {
    calls++;
    return state;
  });
  const wrong = await receipt('wrong', 'cus_other');
  await assert.rejects(worker.process(actor, org.id, wrong.id), { status: 404 });
  assert.equal(await db.billingReconciliationJob.count({ where: { receiptId: wrong.id } }), 0);
  const first = await receipt('first');
  let started!: () => void, release!: () => void;
  const ready = new Promise<void>((r) => {
    started = r;
  });
  const held = new Promise<void>((r) => {
    release = r;
  });
  const slow = make(async () => {
    calls++;
    started();
    await held;
    return state;
  });
  const running = slow.process(actor, org.id, first.id);
  await ready;
  assert.equal((await worker.process(actor, org.id, first.id)).status, 'RUNNING');
  release();
  const completed = await running;
  assert.equal(completed.status, 'SUCCEEDED');
  assert.equal((await worker.process(actor, org.id, first.id)).id, completed.id);
  assert.equal(calls, 1);
  const failedReceipt = await receipt('failure');
  const failing = make(async () => {
    throw new Error('private detail');
  });
  const failed = await failing.process(actor, org.id, failedReceipt.id);
  assert.equal(failed.status, 'RETRY');
  assert.equal(failed.lastCode, 'BILLING_RECONCILIATION_FAILED');
  assert.equal((await worker.process(actor, org.id, failedReceipt.id)).attempts, 1);
  await db.billingReconciliationJob.update({
    where: { id: failed.id },
    data: { availableAt: new Date(0), status: 'RUNNING', leaseToken: crypto.randomUUID(), leaseUntil: new Date(0) },
  });
  assert.equal((await worker.process(actor, org.id, failedReceipt.id)).status, 'SUCCEEDED');
  const crashReceipt = await receipt('crash');
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_billing_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'SUCCEEDED' THEN RAISE EXCEPTION 'Test completion crash'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER test_billing_completion BEFORE UPDATE ON "BillingReconciliationJob" FOR EACH ROW EXECUTE FUNCTION fail_billing_completion()`,
  );
  let crash;
  try {
    crash = await worker.process(actor, org.id, crashReceipt.id);
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER test_billing_completion ON "BillingReconciliationJob"');
    await db.$executeRawUnsafe('DROP FUNCTION fail_billing_completion()');
  }
  assert.equal(crash.status, 'RETRY');
  const before = calls;
  await db.billingReconciliationJob.update({ where: { id: crash.id }, data: { availableAt: new Date(0) } });
  assert.equal((await worker.process(actor, org.id, crashReceipt.id)).status, 'SUCCEEDED');
  assert.equal(calls, before);
  assert.equal(await db.billingSubscriptionRevision.count({ where: { subscriptionId: subscription.id } }), 3);
  assert.equal((await worker.runOnce(actor, org.id)).length, 0);
  await receipt('lateDelivery');
  state.status = 'canceled';
  const scanned = await worker.runOnce(actor, org.id);
  assert.equal(scanned.length, 1);
  assert.equal(scanned[0].status, 'SUCCEEDED');
  const latest = await db.billingSubscriptionRevision.findUniqueOrThrow({ where: { id: scanned[0].revisionId! } });
  assert.equal(latest.providerStatus, 'canceled');
  await db.membership.update({
    where: { organisationId_userId: { organisationId: org.id, userId: user.id } },
    data: { role: 'ADMIN' },
  });
  await assert.rejects(worker.process(actor, org.id, first.id), { status: 403 });
  await assert.rejects(worker.runOnce(actor, org.id), { status: 403 });

  assert.equal((await db.organisation.findUniqueOrThrow({ where: { id: org.id } })).planKey, 'STARTER');
  console.log(
    '✓ reconciliation binding checks, exclusive claims, retry delays, expired lease recovery and crash-safe revision reuse',
  );
}
