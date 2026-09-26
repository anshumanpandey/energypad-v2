import 'dotenv/config';
import { parseBillingCatalogue } from '../src/server/billing-catalogue';

try {
  const catalogue = parseBillingCatalogue(process.env.BILLING_PRICE_CATALOGUE);
  if (!catalogue) {
    console.log('Billing price catalogue is unconfigured. Checkout remains unavailable.');
  } else {
    console.log(
      JSON.stringify(
        {
          version: catalogue.version,
          fingerprint: catalogue.fingerprint,
          mode: catalogue.mode,
          mappings: catalogue.prices.length,
          providerVerified: false,
          checkoutEnabled: false,
        },
        null,
        2,
      ),
    );
  }
} catch {
  console.error('Billing price catalogue configuration is invalid. Check the documented schema.');
  process.exitCode = 1;
}
