import { db } from '@/server/db';
import { writesFrozen, freezeResponse } from '@/server/write-freeze';
import { StripeWebhookReceipts, webhookResponse } from '@/server/stripe-webhooks';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (writesFrozen()) return freezeResponse();
  const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
  const account = process.env.STRIPE_TEST_ACCOUNT_ID;
  const service =
    process.env.STRIPE_WEBHOOK_RECEIPTS_ENABLED === 'true' && secret && account
      ? new StripeWebhookReceipts(db, secret, account)
      : null;
  return webhookResponse(request, service);
}
