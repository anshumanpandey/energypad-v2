import 'dotenv/config';
import { db } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { BillingBindingService } from '../src/server/billing-binding';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';
import { StripeSubscriptionReader } from '../src/server/stripe-reader';
import { readMigrationJson } from './migration-json';
import { z } from 'zod';
try {
  const [file, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw new Error('Usage: billing:bind -- reviewed-binding.json');
  const manifest = z
    .object({
      organisationId: z.uuid(),
      ownerUserId: z.uuid(),
      accountId: z.string(),
      customerId: z.string(),
      subscriptionId: z.string(),
      reviewReference: z.string(),
    })
    .strict()
    .parse(await readMigrationJson(file, 16384));
  if (manifest.accountId !== process.env.STRIPE_TEST_ACCOUNT_ID) throw new Error('Account mismatch');
  const reader = new StripeSubscriptionReader(process.env.STRIPE_TEST_SECRET_KEY ?? '', manifest.accountId);
  const service = new BillingBindingService(
    db,
    {
      async send() {
        throw new Error('Mail disabled');
      },
    },
    'http://localhost',
    parseBillingCatalogue(process.env.BILLING_PRICE_CATALOGUE),
    reader,
  );
  const { organisationId, ownerUserId, ...binding } = manifest;
  console.log(JSON.stringify(await service.bind(actorFor(ownerUserId), organisationId, binding)));
} catch {
  console.error(
    'Billing binding failed. Check the reviewed manifest, owner access, test configuration and existing bindings.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
