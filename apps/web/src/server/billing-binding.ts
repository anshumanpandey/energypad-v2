import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { FoundationService, type Actor, type Mailer } from './foundation';
import { DomainError } from '../domain/policy';
import { subscriptionSnapshotSchema, type SubscriptionReader } from './billing-ingestion';
import { type BillingCatalogue, resolveBillingPrice } from './billing-catalogue';
import { snapshotHash } from './analysis/contract';
const identifier = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`))
    .max(255);
const bindingInput = z
  .object({
    accountId: identifier('acct'),
    customerId: identifier('cus'),
    subscriptionId: identifier('sub'),
    reviewReference: z.string().trim().min(10).max(500),
  })
  .strict();
const conflict = () =>
  new DomainError('BILLING_BINDING_CONFLICT', 'Billing identity is already bound differently.', 409);

// Operator-only tool. Provider identity verification is not proof of workspace ownership:
// the operator must review the explicit workspace/customer association before invoking it.
export class BillingBindingService extends FoundationService {
  constructor(
    db: PrismaClient,
    mail: Mailer,
    url: string,
    private catalogue: BillingCatalogue,
    private provider: SubscriptionReader,
  ) {
    super(db, mail, url);
  }
  async bind(actor: Actor, org: string, input: unknown) {
    const data = bindingInput.parse(input);
    await this.membership(actor, org, 'billing:manage');
    if (!this.catalogue) throw new DomainError('BILLING_NOT_CONFIGURED', 'Billing prices are not configured.', 503);
    const evidence = subscriptionSnapshotSchema.parse(
      await this.provider.read({ accountId: data.accountId, subscriptionId: data.subscriptionId }),
    );
    if (
      evidence.accountId !== data.accountId ||
      evidence.subscriptionId !== data.subscriptionId ||
      evidence.customerId !== data.customerId ||
      evidence.price.accountId !== data.accountId
    )
      throw new DomainError('BILLING_PROVIDER_SCOPE', 'Provider identity does not match the reviewed binding.', 409);
    const price = resolveBillingPrice(this.catalogue, evidence.price.id);
    if (price.currency !== evidence.price.currency || price.interval !== evidence.price.interval)
      throw new DomainError('BILLING_PRICE_MISMATCH', 'Provider price terms do not match the catalogue.', 409);
    const evidenceHash = snapshotHash(evidence);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'billing:manage', tx);
      // Serialize binding changes across organisations in this provider account.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`billing-binding:${data.accountId}:test`}, 0))`;
      const existingCustomer = await tx.billingCustomer.findUnique({
        where: {
          providerAccountId_mode_providerCustomerId: {
            providerAccountId: data.accountId,
            mode: 'test',
            providerCustomerId: data.customerId,
          },
        },
      });
      const organisationCustomer = await tx.billingCustomer.findUnique({
        where: {
          organisationId_providerAccountId_mode: {
            organisationId: org,
            providerAccountId: data.accountId,
            mode: 'test',
          },
        },
      });
      if (
        (existingCustomer && existingCustomer.organisationId !== org) ||
        (organisationCustomer && organisationCustomer.providerCustomerId !== data.customerId)
      )
        throw conflict();
      const existing = await tx.billingSubscription.findUnique({
        where: {
          providerAccountId_mode_providerSubscriptionId: {
            providerAccountId: data.accountId,
            mode: 'test',
            providerSubscriptionId: data.subscriptionId,
          },
        },
      });
      if (existing) {
        if (existing.organisationId !== org || existing.customerId !== existingCustomer?.id) throw conflict();
        return { customerId: existing.customerId, subscriptionId: existing.id, reused: true };
      }
      const customer =
        existingCustomer ??
        (await tx.billingCustomer.create({
          data: {
            organisationId: org,
            providerAccountId: data.accountId,
            mode: 'test',
            providerCustomerId: data.customerId,
          },
        }));
      const subscription = await tx.billingSubscription.create({
        data: {
          organisationId: org,
          customerId: customer.id,
          providerAccountId: data.accountId,
          mode: 'test',
          providerSubscriptionId: data.subscriptionId,
        },
      });
      const revision = await tx.billingSubscriptionRevision.create({
        data: {
          organisationId: org,
          subscriptionId: subscription.id,
          revision: 1,
          observationKey: `binding:${subscription.id}`,
          providerStatus: evidence.status,
          providerPriceId: price.priceId,
          mappedPlanKey: price.planKey,
          catalogueVersion: price.catalogueVersion,
          catalogueFingerprint: price.catalogueFingerprint,
          evidence,
          evidenceHash,
          observedAt: new Date(),
        },
      });
      await this.audit(tx, actor, org, 'billing.subscription_bound', subscription.id, {
        customerId: customer.id,
        revisionId: revision.id,
        reviewReference: data.reviewReference,
        evidenceHash,
        providerAccountId: data.accountId,
        catalogueFingerprint: price.catalogueFingerprint,
      });
      return { customerId: customer.id, subscriptionId: subscription.id, reused: false };
    });
  }
}
