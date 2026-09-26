import 'dotenv/config';
import { db } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { BillingReconciliationWorker } from '../src/server/billing-reconciliation';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';
import { StripeSubscriptionReader } from '../src/server/stripe-reader';
import { z } from 'zod';
try {
  const [org, user, ...extra] = process.argv.slice(2);
  if (extra.length || !z.uuid().safeParse(org).success || !z.uuid().safeParse(user).success)
    throw new Error('Invalid arguments');
  const catalogue = parseBillingCatalogue(process.env.BILLING_PRICE_CATALOGUE);
  if (!catalogue) throw new Error('Catalogue required');
  const reader = new StripeSubscriptionReader(
    process.env.STRIPE_TEST_SECRET_KEY ?? '',
    process.env.STRIPE_TEST_ACCOUNT_ID ?? '',
  );
  const worker = new BillingReconciliationWorker(
    db,
    {
      async send() {
        throw new Error('Mail disabled');
      },
    },
    'http://localhost:3100',
    catalogue,
    reader,
  );
  const jobs = await worker.runOnce(actorFor(user), org);
  console.log(
    JSON.stringify({
      processed: jobs.length,
      succeeded: jobs.filter((j) => j.status === 'SUCCEEDED').length,
      retry: jobs.filter((j) => j.status === 'RETRY').length,
    }),
  );
  if (jobs.some((j) => j.status !== 'SUCCEEDED')) process.exitCode = 2;
} catch {
  console.error(
    'Billing reconciliation failed. Check workspace/owner IDs, test configuration and database availability.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
