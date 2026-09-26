import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { actorFor } from '../src/server/foundation';
import { BillingBindingService } from '../src/server/billing-binding';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';
import type { SubscriptionSnapshot } from '../src/server/billing-ingestion';
export async function checkBillingBinding(db: PrismaClient) {
  const org = await db.organisation.create({ data: { name: 'Binding test', slug: crypto.randomUUID() } });
  const other = await db.organisation.create({ data: { name: 'Binding other', slug: crypto.randomUUID() } });
  const user = await db.user.create({ data: { email: 'binding-owner@example.test', emailVerified: new Date() } });
  const actor = actorFor(user.id);
  const member = await db.membership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER' } });
  await db.membership.create({ data: { organisationId: other.id, userId: user.id, role: 'OWNER' } });
  const catalogue = parseBillingCatalogue(
    JSON.stringify({
      version: 'fixture-v1',
      mode: 'test',
      prices: [{ priceId: 'price_binding', planKey: 'GROWTH', currency: 'gbp', interval: 'month' }],
    }),
  );
  const evidence: SubscriptionSnapshot = {
    accountId: 'acct_binding',
    mode: 'test',
    customerId: 'cus_binding',
    subscriptionId: 'sub_binding',
    status: 'active',
    price: {
      id: 'price_binding',
      currency: 'gbp',
      interval: 'month',
      intervalCount: 1,
      quantity: 1,
      mode: 'test',
      accountId: 'acct_binding',
    },
  };
  let calls = 0;
  const make = (read: () => Promise<SubscriptionSnapshot>) =>
    new BillingBindingService(db, { async send() {} }, 'http://localhost', catalogue, { read });
  const service = make(async () => {
    calls++;
    return evidence;
  });
  const input = {
    accountId: evidence.accountId,
    customerId: evidence.customerId,
    subscriptionId: evidence.subscriptionId,
    reviewReference: 'Reviewed synthetic workspace association',
  };
  await assert.rejects(service.bind(actor, org.id, { ...input, customerId: 'cus_wrong' }), {
    code: 'BILLING_PROVIDER_SCOPE',
  });
  const bound = await Promise.all([service.bind(actor, org.id, input), service.bind(actor, org.id, input)]);
  assert.equal(bound[0].subscriptionId, bound[1].subscriptionId);
  assert.equal(bound.filter((b) => !b.reused).length, 1);
  assert.equal(
    await db.auditEvent.count({ where: { action: 'billing.subscription_bound', targetId: bound[0].subscriptionId } }),
    1,
  );
  assert.equal(await db.billingSubscriptionRevision.count({ where: { subscriptionId: bound[0].subscriptionId } }), 1);
  await assert.rejects(service.bind(actor, other.id, input), { code: 'BILLING_BINDING_CONFLICT' });
  const replacement = { ...evidence, customerId: 'cus_replacement', subscriptionId: 'sub_replacement' };
  await assert.rejects(
    make(async () => replacement).bind(actor, org.id, {
      ...input,
      customerId: replacement.customerId,
      subscriptionId: replacement.subscriptionId,
    }),
    { code: 'BILLING_BINDING_CONFLICT' },
  );
  await db.membership.update({ where: { id: member.id }, data: { role: 'ADMIN' } });
  const before = calls;
  await assert.rejects(service.bind(actor, org.id, input), { status: 403 });
  assert.equal(calls, before);
  await db.membership.update({ where: { id: member.id }, data: { role: 'OWNER' } });
  await assert.rejects(
    make(async () => {
      await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
      return evidence;
    }).bind(actor, org.id, input),
    { status: 404 },
  );
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: null } });
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_binding_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'billing.subscription_bound' THEN RAISE EXCEPTION 'Test binding audit failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER test_binding_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_binding_audit()`,
  );
  try {
    await assert.rejects(
      make(async () => replacement).bind(actor, other.id, {
        ...input,
        customerId: replacement.customerId,
        subscriptionId: replacement.subscriptionId,
      }),
    );
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER test_binding_audit ON "AuditEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION fail_binding_audit()');
  }
  assert.equal(await db.billingCustomer.count({ where: { organisationId: other.id } }), 0);
  assert.equal(await db.billingSubscription.count({ where: { organisationId: other.id } }), 0);
  assert.equal((await db.organisation.findUniqueOrThrow({ where: { id: org.id } })).planKey, 'STARTER');
  console.log(
    '✓ reviewed binding identity checks, cross-workspace conflicts, concurrent reuse, post-fetch revocation and atomic audit rollback',
  );
}
