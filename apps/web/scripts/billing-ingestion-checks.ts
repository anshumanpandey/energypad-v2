import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { BillingIngestionService, type SubscriptionSnapshot } from '../src/server/billing-ingestion';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';
import { actorFor } from '../src/server/foundation';
export async function checkBillingIngestion(db: PrismaClient, org: string, subscriptionId: string) {
  const user = await db.user.create({ data: { email: 'billing-owner@example.test', emailVerified: new Date() } });
  const actor = actorFor(user.id);
  const member = await db.membership.create({ data: { organisationId: org, userId: user.id, role: 'OWNER' } });
  const outsider = actorFor(
    (await db.user.create({ data: { email: 'billing-outsider@example.test', emailVerified: new Date() } })).id,
  );
  const catalogue = parseBillingCatalogue(
    JSON.stringify({
      version: 'fixture-v1',
      mode: 'test',
      prices: [{ priceId: 'price_fixture', planKey: 'GROWTH', currency: 'gbp', interval: 'month' }],
    }),
  );
  const snapshot: SubscriptionSnapshot = {
    accountId: 'fixture-account',
    mode: 'test',
    customerId: 'fixture-customer',
    subscriptionId: 'fixture-subscription',
    status: 'fixture-active',
    price: {
      id: 'price_fixture',
      currency: 'gbp',
      interval: 'month',
      intervalCount: 1,
      quantity: 1,
      mode: 'test',
      accountId: 'fixture-account',
    },
  };
  let calls = 0;
  const serviceFor = (read: () => Promise<SubscriptionSnapshot>) =>
    new BillingIngestionService(db, { async send() {} }, 'http://localhost:3100', catalogue, { read });
  const service = serviceFor(async () => {
    calls++;
    return snapshot;
  });
  await assert.rejects(service.observe(outsider, org, subscriptionId, 'outside'), { status: 404 });
  assert.equal(calls, 0);
  const first = await service.observe(actor, org, subscriptionId, 'fetch-1');
  assert.equal(first.mappedPlanKey, 'GROWTH');
  assert.equal((await service.observe(actor, org, subscriptionId, 'fetch-1')).id, first.id);
  assert.equal(calls, 1);
  assert.equal(
    await db.auditEvent.count({ where: { action: 'billing.subscription_observed', targetId: first.id } }),
    1,
  );
  for (const invalid of [
    { ...snapshot, accountId: 'foreign' },
    { ...snapshot, customerId: 'foreign' },
    { ...snapshot, subscriptionId: 'foreign' },
    { ...snapshot, price: { ...snapshot.price, currency: 'usd' } },
    { ...snapshot, price: { ...snapshot.price, interval: 'year' as const } },
    { ...snapshot, price: { ...snapshot.price, id: 'price_unmapped' } },
    { ...snapshot, price: { ...snapshot.price, accountId: 'foreign' } },
  ])
    await assert.rejects(serviceFor(async () => invalid).observe(actor, org, subscriptionId, crypto.randomUUID()));
  let release!: () => void;
  let started!: () => void;
  const signal = new Promise<void>((resolve) => {
    started = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delayed = serviceFor(async () => {
    started();
    await held;
    return snapshot;
  });
  const slow = delayed.observe(actor, org, subscriptionId, 'slow-fetch');
  await signal;
  await service.observe(actor, org, subscriptionId, 'newer-fetch');
  release();
  await assert.rejects(slow, { code: 'BILLING_STALE_OBSERVATION' });
  const duplicate = await Promise.all([
    service.observe(actor, org, subscriptionId, 'duplicate-fetch'),
    service.observe(actor, org, subscriptionId, 'duplicate-fetch'),
  ]);
  assert.equal(duplicate[0].id, duplicate[1].id);
  await assert.rejects(
    serviceFor(async () => {
      await db.membership.update({ where: { id: member.id }, data: { role: 'ADMIN' } });
      return snapshot;
    }).observe(actor, org, subscriptionId, 'demoted-fetch'),
    { status: 403 },
  );
  await assert.rejects(service.observe(actor, org, subscriptionId, 'fetch-1'), { status: 403 });
  await db.membership.update({ where: { id: member.id }, data: { role: 'OWNER' } });
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_billing_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'billing.subscription_observed' THEN RAISE EXCEPTION 'Test audit failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER test_billing_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_billing_audit()`,
  );
  try {
    await assert.rejects(service.observe(actor, org, subscriptionId, 'failed-audit'));
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER test_billing_audit ON "AuditEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION fail_billing_audit()');
  }
  assert.equal(
    await db.billingSubscriptionRevision.count({
      where: { observationKey: { in: ['slow-fetch', 'demoted-fetch', 'failed-audit'] } },
    }),
    0,
  );
  assert.equal((await db.organisation.findUniqueOrThrow({ where: { id: org } })).planKey, 'STARTER');
  console.log(
    '✓ subscription ingestion price/scope validation, atomic audit, retries, stale fetch rejection and post-fetch authorization',
  );
}
