import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError, plans } from '../domain/policy';

const entry = z
  .object({
    priceId: z
      .string()
      .regex(/^price_[A-Za-z0-9]+$/)
      .max(255),
    planKey: z.enum(plans.map((plan) => plan.key)),
    currency: z.string().regex(/^[a-z]{3}$/),
    interval: z.enum(['month', 'year']),
  })
  .strict();
const schema = z
  .object({
    version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
    mode: z.literal('test'),
    prices: z.array(entry).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const offers = new Set<string>();
    for (const price of value.prices) {
      const offer = `${price.planKey}:${price.currency}:${price.interval}`;
      if (ids.has(price.priceId) || offers.has(offer))
        context.addIssue({ code: 'custom', message: 'Duplicate price or plan/currency/interval mapping' });
      ids.add(price.priceId);
      offers.add(offer);
    }
  });
export type BillingCatalogue = ReturnType<typeof parseBillingCatalogue>;

// Accept only server configuration. Never use a request body as the catalogue.
// Syntax validation cannot establish a price's actual provider mode or terms.
export function parseBillingCatalogue(raw: string | undefined) {
  if (!raw?.trim()) return null;
  try {
    if (Buffer.byteLength(raw, 'utf8') > 32768) throw new Error('Catalogue too large');
    const parsed = schema.parse(JSON.parse(raw));
    const prices = parsed.prices.sort((a, b) => a.priceId.localeCompare(b.priceId));
    const canonical = { version: parsed.version, mode: parsed.mode, prices };
    return Object.freeze({
      ...canonical,
      prices: Object.freeze(prices.map((price) => Object.freeze(price))),
      fingerprint: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    });
  } catch {
    // Do not reflect configuration contents (which might accidentally contain secrets).
    throw new DomainError('BILLING_CONFIGURATION', 'Billing price catalogue configuration is invalid.', 503);
  }
}
export function resolveBillingPrice(catalogue: BillingCatalogue, priceId: string) {
  if (!catalogue) throw new DomainError('BILLING_NOT_CONFIGURED', 'Billing prices are not configured.', 503);
  const price = catalogue.prices.find((entry) => entry.priceId === priceId);
  if (!price) throw new DomainError('BILLING_PRICE_UNMAPPED', 'This billing price is not mapped.', 409);
  return { ...price, catalogueVersion: catalogue.version, catalogueFingerprint: catalogue.fingerprint };
}
