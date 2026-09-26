import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { FoundationService, type Actor, type Mailer } from './foundation';
import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/policy';
import { BillingIngestionService, type SubscriptionReader } from './billing-ingestion';
import type { BillingCatalogue } from './billing-catalogue';

// Owner-operated test worker. It never impersonates an owner or trusts tenant metadata.
export class BillingReconciliationWorker extends FoundationService {
  private ingestion: BillingIngestionService;
  constructor(db: PrismaClient, mail: Mailer, url: string, catalogue: BillingCatalogue, provider: SubscriptionReader) {
    super(db, mail, url);
    this.ingestion = new BillingIngestionService(db, mail, url, catalogue, provider);
  }
  async process(actor: Actor, org: string, receiptId: string) {
    z.uuid().parse(receiptId);
    const token = randomUUID();
    const claimed = await this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'billing:manage', tx);
      const receipt = await tx.billingWebhookReceipt.findUnique({ where: { id: receiptId } });
      if (!receipt?.providerSubscriptionId || !receipt.providerCustomerId)
        throw new DomainError('NOT_FOUND', 'No scoped subscription receipt is available.', 404);
      const subscription = await tx.billingSubscription.findFirst({
        where: {
          organisationId: org,
          providerAccountId: receipt.providerAccountId,
          mode: receipt.mode,
          providerSubscriptionId: receipt.providerSubscriptionId,
          customer: { providerCustomerId: receipt.providerCustomerId },
        },
      });
      if (!subscription) throw new DomainError('NOT_FOUND', 'No scoped subscription receipt is available.', 404);
      await tx.billingReconciliationJob.createMany({
        data: [{ receiptId, organisationId: org, subscriptionId: subscription.id }],
        skipDuplicates: true,
      });
      const job = await tx.billingReconciliationJob.findUniqueOrThrow({ where: { receiptId } });
      const now = new Date();
      if (job.status === 'SUCCEEDED' || job.availableAt > now || (job.leaseUntil && job.leaseUntil > now))
        return { job, claimed: false };
      const updated = await tx.billingReconciliationJob.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          attempts: { increment: 1 },
          leaseToken: token,
          leaseUntil: new Date(now.getTime() + 120_000),
          lastCode: null,
        },
      });
      return { job: updated, claimed: true };
    });
    if (!claimed.claimed) return claimed.job;
    try {
      // Stable observation key recovers a committed revision after a worker crash.
      const revision = await this.ingestion.observe(actor, org, claimed.job.subscriptionId, `receipt:${receiptId}`);
      await this.db.billingReconciliationJob.updateMany({
        where: { id: claimed.job.id, leaseToken: token },
        data: {
          status: 'SUCCEEDED',
          revisionId: revision.id,
          leaseToken: null,
          leaseUntil: null,
          lastCode: null,
        },
      });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : 'BILLING_RECONCILIATION_FAILED';
      const delay = Math.min(3600, 60 * 2 ** Math.min(claimed.job.attempts - 1, 6));
      await this.db.billingReconciliationJob.updateMany({
        where: { id: claimed.job.id, leaseToken: token },
        data: {
          status: 'RETRY',
          lastCode: code,
          availableAt: new Date(Date.now() + delay * 1000),
          leaseToken: null,
          leaseUntil: null,
        },
      });
    }
    // Losing permission during retrieval cannot expose subscription/job results.
    await this.membership(actor, org, 'billing:manage');
    return this.db.billingReconciliationJob.findUniqueOrThrow({ where: { id: claimed.job.id } });
  }
  async runOnce(actor: Actor, org: string) {
    await this.membership(actor, org, 'billing:manage');
    const now = new Date();
    // Resolve only existing immutable bindings for this workspace. Unbound receipts remain in the inbox.
    const subscriptions = await this.db.billingSubscription.findMany({
      where: { organisationId: org },
      include: { customer: true },
    });
    if (!subscriptions.length) return [];
    const receipts = await this.db.billingWebhookReceipt.findMany({
      where: {
        AND: [
          {
            OR: subscriptions.map((s) => ({
              providerAccountId: s.providerAccountId,
              mode: s.mode,
              providerSubscriptionId: s.providerSubscriptionId,
              providerCustomerId: s.customer.providerCustomerId,
            })),
          },
          {
            OR: [
              { job: null },
              { job: { status: 'RETRY', availableAt: { lte: now } } },
              { job: { status: 'PENDING' } },
              { job: { status: 'RUNNING', leaseUntil: { lte: now } } },
            ],
          },
        ],
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    const results = [];
    for (const receipt of receipts) results.push(await this.process(actor, org, receipt.id));
    return results;
  }
}
