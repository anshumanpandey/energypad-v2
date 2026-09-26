import { checkBillingBinding } from './billing-binding-checks';
import { checkBillingWorker } from './billing-worker-checks';
import { checkWebhookReceipts } from './billing-webhook-checks';
import { checkBillingIngestion } from './billing-ingestion-checks';
import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
try {
  const org = await db.organisation.create({ data: { name: 'Billing fixture', slug: crypto.randomUUID() } });
  const other = await db.organisation.create({ data: { name: 'Other fixture', slug: crypto.randomUUID() } });
  const customerData = {
    organisationId: org.id,
    providerAccountId: 'fixture-account',
    mode: 'test',
    providerCustomerId: 'fixture-customer',
  };
  const customer = await db.billingCustomer.create({ data: customerData });
  await assert.rejects(db.billingCustomer.create({ data: { ...customerData, organisationId: other.id } }));
  await assert.rejects(db.billingCustomer.create({ data: { ...customerData, mode: 'live' } }));
  const subscriptionData = {
    organisationId: org.id,
    customerId: customer.id,
    providerAccountId: customer.providerAccountId,
    mode: 'test',
    providerSubscriptionId: 'fixture-subscription',
  };
  await assert.rejects(db.billingSubscription.create({ data: { ...subscriptionData, organisationId: other.id } }));
  await assert.rejects(
    db.billingSubscription.create({ data: { ...subscriptionData, providerAccountId: 'other-account' } }),
  );
  const subscription = await db.billingSubscription.create({ data: subscriptionData });
  await assert.rejects(db.billingSubscription.create({ data: subscriptionData }));
  const revisionData = {
    subscriptionId: subscription.id,
    organisationId: org.id,
    revision: 1,
    observationKey: 'observation-1',
    providerStatus: 'fixture-status',
    providerPriceId: 'fixture-price',
    catalogueVersion: 'fixture-v1',
    catalogueFingerprint: 'a'.repeat(64),
    mappedPlanKey: 'GROWTH' as const,
    evidence: { fixture: true },
    evidenceHash: 'b'.repeat(64),
    observedAt: new Date(),
  };
  await assert.rejects(db.billingSubscriptionRevision.create({ data: { ...revisionData, organisationId: other.id } }));
  await assert.rejects(db.billingSubscriptionRevision.create({ data: { ...revisionData, revision: 2 } }));
  await assert.rejects(db.billingSubscriptionRevision.create({ data: { ...revisionData, evidenceHash: 'invalid' } }));
  const first = await db.billingSubscriptionRevision.create({ data: revisionData });
  await assert.rejects(db.billingSubscriptionRevision.create({ data: revisionData }));
  await assert.rejects(
    db.billingSubscriptionRevision.create({ data: { ...revisionData, observationKey: 'bad-root', revision: 2 } }),
  );
  const secondData = { ...revisionData, previousId: first.id, revision: 2, observationKey: 'observation-2' };
  const raced = await Promise.allSettled([
    db.billingSubscriptionRevision.create({ data: secondData }),
    db.billingSubscriptionRevision.create({ data: { ...secondData, observationKey: 'observation-race' } }),
  ]);
  assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(
    db.billingSubscriptionRevision.create({ data: { ...secondData, revision: 3, observationKey: 'branched' } }),
  );
  await assert.rejects(db.billingCustomer.update({ where: { id: customer.id }, data: { organisationId: other.id } }));
  await assert.rejects(db.billingSubscription.delete({ where: { id: subscription.id } }));
  await assert.rejects(
    db.billingSubscriptionRevision.update({ where: { id: first.id }, data: { providerStatus: 'rewritten' } }),
  );
  for (const table of ['BillingCustomer', 'BillingSubscription', 'BillingSubscriptionRevision'])
    await assert.rejects(db.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`));
  assert.equal((await db.organisation.findUniqueOrThrow({ where: { id: org.id } })).planKey, 'STARTER');
  assert.equal(await db.billingSubscriptionRevision.count(), 2);
  await checkBillingIngestion(db, org.id, subscription.id);
  await checkWebhookReceipts(db);
  await checkBillingWorker(db);
  await checkBillingBinding(db);
  console.log(
    '✓ billing identity scope, test-mode restriction, immutable lineage, concurrent revisions, duplicate observations and unchanged plan access',
  );
} finally {
  await cleanup();
}
