import { z } from 'zod';
import { FoundationService, type Actor, type Mailer } from './foundation';
import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/policy';
import { type BillingCatalogue, resolveBillingPrice } from './billing-catalogue';
import { snapshotHash } from './analysis/contract';

// Normalized provider evidence, not a Stripe webhook payload or an access decision.
export const subscriptionSnapshotSchema = z
  .object({
    accountId: z.string().min(1).max(255),
    mode: z.literal('test'),
    customerId: z.string().min(1).max(255),
    subscriptionId: z.string().min(1).max(255),
    status: z.string().min(1).max(100),
    price: z
      .object({
        id: z.string().min(1).max(255),
        currency: z.string().regex(/^[a-z]{3}$/),
        interval: z.enum(['month', 'year']),
        intervalCount: z.literal(1),
        quantity: z.literal(1),
        mode: z.literal('test'),
        accountId: z.string().min(1).max(255),
      })
      .strict(),
  })
  .strict();
export type SubscriptionSnapshot = z.infer<typeof subscriptionSnapshotSchema>;
export interface SubscriptionReader {
  // Implementation must retrieve authentic current state from the intended provider account.
  // Do not implement by returning client metadata or an unverified event body.
  read(input: { accountId: string; subscriptionId: string }): Promise<SubscriptionSnapshot>;
}
export class BillingIngestionService extends FoundationService {
  constructor(
    db: PrismaClient,
    mail: Mailer,
    url: string,
    private catalogue: BillingCatalogue,
    private provider: SubscriptionReader,
  ) {
    super(db, mail, url);
  }

  async observe(actor: Actor, organisationId: string, subscriptionId: string, observationKey: string) {
    z.uuid().parse(subscriptionId);
    z.string().min(1).max(255).parse(observationKey);
    // Use a pre-bound local identity. Never create tenant bindings from provider metadata.
    const initial = await this.db.$transaction(
      async (tx) => {
        await this.membership(actor, organisationId, 'billing:manage', tx);
        const subscription = await tx.billingSubscription.findFirst({
          where: { id: subscriptionId, organisationId },
          include: { customer: true },
        });
        if (!subscription) throw new DomainError('NOT_FOUND', 'This subscription is unavailable.', 404);
        const retry = await tx.billingSubscriptionRevision.findUnique({
          where: { subscriptionId_observationKey: { subscriptionId, observationKey } },
        });
        const latest = await tx.billingSubscriptionRevision.findFirst({
          where: { subscriptionId },
          orderBy: { revision: 'desc' },
        });
        return { subscription, retry, previousId: latest?.id ?? null };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    if (initial.retry) return initial.retry;
    if (!this.catalogue) throw new DomainError('BILLING_NOT_CONFIGURED', 'Billing prices are not configured.', 503);
    const subscription = initial.subscription;
    const evidence = subscriptionSnapshotSchema.parse(
      await this.provider.read({
        accountId: subscription.providerAccountId,
        subscriptionId: subscription.providerSubscriptionId,
      }),
    );
    if (
      evidence.accountId !== subscription.providerAccountId ||
      evidence.mode !== subscription.mode ||
      evidence.subscriptionId !== subscription.providerSubscriptionId ||
      evidence.customerId !== subscription.customer.providerCustomerId ||
      evidence.price.accountId !== evidence.accountId
    )
      throw new DomainError(
        'BILLING_PROVIDER_SCOPE',
        'Provider subscription identity does not match its binding.',
        409,
      );
    const mapped = resolveBillingPrice(this.catalogue, evidence.price.id);
    if (mapped.currency !== evidence.price.currency || mapped.interval !== evidence.price.interval)
      throw new DomainError('BILLING_PRICE_MISMATCH', 'Provider price terms do not match the catalogue.', 409);
    const observedAt = new Date();
    const evidenceHash = snapshotHash(evidence);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      await this.membership(actor, organisationId, 'billing:manage', tx);
      const retry = await tx.billingSubscriptionRevision.findUnique({
        where: { subscriptionId_observationKey: { subscriptionId, observationKey } },
      });
      // One observation key represents one fetch operation. Concurrent duplicates reuse its result.
      if (retry) return retry;
      const latest = await tx.billingSubscriptionRevision.findFirst({
        where: { subscriptionId },
        orderBy: { revision: 'desc' },
      });
      if ((latest?.id ?? null) !== initial.previousId)
        throw new DomainError(
          'BILLING_STALE_OBSERVATION',
          'Subscription changed during retrieval. Fetch current state again.',
          409,
        );
      const revision = await tx.billingSubscriptionRevision.create({
        data: {
          subscriptionId,
          organisationId,
          previousId: latest?.id ?? null,
          revision: (latest?.revision ?? 0) + 1,
          observationKey,
          providerStatus: evidence.status,
          providerPriceId: mapped.priceId,
          catalogueVersion: mapped.catalogueVersion,
          catalogueFingerprint: mapped.catalogueFingerprint,
          mappedPlanKey: mapped.planKey,
          evidence,
          evidenceHash,
          observedAt,
        },
      });
      await this.audit(tx, actor, organisationId, 'billing.subscription_observed', revision.id, {
        subscriptionId,
        observationKey,
        evidenceHash,
        catalogueFingerprint: mapped.catalogueFingerprint,
      });
      return revision;
    });
  }
}
