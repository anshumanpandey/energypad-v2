import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/policy';
import { snapshotHash } from './analysis/contract';
const invalid = () => new DomainError('BILLING_WEBHOOK_INVALID', 'Invalid Stripe webhook.', 400);
const identifier = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`))
    .max(255);
const envelope = z.object({
  id: identifier('evt'),
  object: z.literal('event'),
  type: z.string().min(1).max(100),
  livemode: z.literal(false),
  created: z.number().int().min(0).max(253402300799),
  account: identifier('acct').optional(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
const subscriptionTypes = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
export const webhookBodyLimit = 262144;
export function verifyStripeEvent(
  raw: Buffer,
  header: string | null,
  secret: string,
  accountId: string,
  now = Date.now(),
) {
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret) || !identifier('acct').safeParse(accountId).success)
    throw new DomainError('BILLING_CONFIGURATION', 'Stripe webhook receipts are not configured.', 503);
  if (raw.length > webhookBodyLimit) throw new DomainError('BODY_TOO_LARGE', 'Webhook is too large.', 413);
  if (!header || header.length > 8192) throw invalid();
  const parts = header.split(',').map((part) => part.trim().split('='));
  const times = parts.filter(([key]) => key === 't');
  if (times.length !== 1 || !/^\d{1,12}$/.test(times[0][1] ?? '') || times[0].length !== 2) throw invalid();
  const timestamp = times[0][1];
  if (!Number.isFinite(now) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw invalid();
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  const signatures = parts.filter(([key, value]) => key === 'v1' && /^[a-fA-F0-9]{64}$/.test(value ?? ''));
  if (!signatures.some((part) => part.length === 2 && timingSafeEqual(expected, Buffer.from(part[1], 'hex'))))
    throw invalid();
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    const event = envelope.parse(parsed);
    // This endpoint supports direct account events, not Connect event routing.
    if (event.account !== undefined) throw invalid();
    const supported = subscriptionTypes.has(event.type);
    const object = supported
      ? z
          .object({
            id: identifier('sub'),
            object: z.literal('subscription'),
            customer: identifier('cus'),
            livemode: z.literal(false),
          })
          .parse(event.data.object)
      : null;
    return {
      providerAccountId: accountId,
      mode: 'test',
      providerEventId: event.id,
      eventType: event.type,
      providerSubscriptionId: object?.id ?? null,
      providerCustomerId: object?.customer ?? null,
      providerCreatedAt: new Date(event.created * 1000),
      payloadHash: snapshotHash(parsed),
    };
  } catch {
    throw invalid();
  }
}
export class StripeWebhookReceipts {
  constructor(
    private db: PrismaClient,
    private secret: string,
    private accountId: string,
  ) {}
  async receive(raw: Buffer, signature: string | null) {
    const data = verifyStripeEvent(raw, signature, this.secret, this.accountId);
    return this.db.$transaction(async (tx) => {
      // ON CONFLICT deduplicates concurrent deliveries without aborting the transaction.
      await tx.billingWebhookReceipt.createMany({ data: [data], skipDuplicates: true });
      const receipt = await tx.billingWebhookReceipt.findUniqueOrThrow({
        where: {
          providerAccountId_mode_providerEventId: {
            providerAccountId: data.providerAccountId,
            mode: data.mode,
            providerEventId: data.providerEventId,
          },
        },
      });
      if (receipt.payloadHash !== data.payloadHash)
        throw new DomainError('BILLING_EVENT_CONFLICT', 'Event identity was reused with different evidence.', 409);
      return receipt;
    });
  }
}
export async function webhookResponse(request: Request, service: Pick<StripeWebhookReceipts, 'receive'> | null) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!service) return Response.json({ code: 'BILLING_NOT_CONFIGURED' }, { status: 503, headers });
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader)
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > webhookBodyLimit) {
            await reader.cancel();
            throw new DomainError('BODY_TOO_LARGE', 'Webhook is too large.', 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    await service.receive(Buffer.concat(chunks), request.headers.get('stripe-signature'));
    return Response.json({ received: true }, { headers });
  } catch (error) {
    return Response.json(
      { code: error instanceof DomainError ? error.code : 'BILLING_RECEIPT_FAILED' },
      {
        status: error instanceof DomainError ? error.status : 500,
        headers,
      },
    );
  }
}
