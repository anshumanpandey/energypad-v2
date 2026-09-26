# Sprint 7 — commercial foundations

Sprint 7 begins with an owner-only plan and usage overview. Independent commercial work can proceed while Sprint 6's methodological approval and deferred OpenAI acceptance remain open. This does not mark those gates accepted.

## First increment: assigned plan and site usage

Billing replaces its placeholder with the assigned plan, active-site count, site limit, remaining capacity and plan entitlements. The page and GET /api/v1/organisations/:org/billing use one owner-authorized service. The service reads under repeatable-read isolation; outsiders and revoked memberships are denied and non-owner roles cannot read the overview.

The Plan database row supplies the site limit, matching site/import capacity enforcement. The existing hasFeature policy supplies feature inclusion, matching current application feature checks. These two existing sources are intentionally identified rather than silently introducing a new entitlement policy. The assigned-plan policy foundation below now centralizes resolution of these sources; persistent subscription and catalogue versioning remains open.

The overview explicitly says billing is not connected and the assigned plan is not proof of a paid subscription. There are no invented prices, trial dates, renewal dates, invoices, checkout links or upgrade controls. Entitlement inclusion is separate from rollout/configuration and role permissions. Archived sites do not consume active-site capacity. Unlimited capacity remains null; over-limit remaining capacity is zero without hiding the over-limit condition.

This increment creates no subscription records, changes no assigned plans and makes no Stripe or OpenAI calls. No migration or new dependency is required.

## Remaining delivery sequence

1. Define and approve the commercial policy and provider configuration below.
2. Add versioned subscription state and a server-owned price-to-plan catalogue. Centralize effective entitlements and quotas; preserve historical analytics and fail safely for unmapped prices.
3. Integrate Stripe test-mode checkout and owner-only customer portal sessions. Bind customer/subscription identities to tenant records on the server.
4. Process signed webhooks with durable receipt deduplication, atomic subscription/audit changes, ordering/reconciliation and retry tests. Cover renewal, cancellation, payment failures and plan changes.
5. Enforce effective entitlements and approved AI quotas across server entry points; keep OpenAI execution deferred until authorized separately.
6. Add scheduled reports with explicit tenant scope and retained result versions, including access revocation, schedule changes and delivery failure handling.
7. Complete test-mode lifecycle, tenant-isolation and duplicate/out-of-order webhook acceptance before enabling live payments.

## Decisions needed before commercial activation

- Monthly and annual prices and currencies for each plan; Stripe test account and server-side price IDs.
- Trial duration, eligibility, card requirement and behavior on expiry.
- Upgrade timing/proration; downgrade timing and over-limit handling.
- Cancellation timing, access after cancellation, payment-failure grace/recovery policy.
- Approved AI quotas, measurement window and overage behavior; scheduled-report limits.
- Exact 100-site boundary: current code permits Professional through 100 and Enterprise without a cap; specification wording overlaps.
- Ownership of tax/invoice settings and live-payment rollout.

Until these are settled, show only assigned-plan information and preserve existing feature/capacity rules. Do not label a local plan assignment as ACTIVE or TRIALING, infer a price, or introduce a new access cutoff.

## Assigned-plan policy foundation

`resolvePlanAccess` is the shared server policy for billing inclusion, site creation/import capacity and AI eligibility. Its `assigned-plan-v1` marker and `LOCAL_ASSIGNMENT` source explicitly describe local assignment, not a subscription or payment claim. Billing exposes these markers for traceability. Persisted site-limit overrides remain authoritative; feature grants continue to come from the existing code catalogue rather than mutable Plan JSON. Unknown plans, mismatched plan relations and invalid capacity values fail closed.

Capacity display and enforcement share boundary calculations, including zero, unlimited, over-limit and batch creation. Existing tenant authorization, write locks, provider configuration and the existing AI attempt safety cap remain in place. This increment does not introduce commercial quotas, gate additional historical analytics, or connect any provider. Durable subscription state, price mapping, catalogue revisions and commercial activation still require the remaining work above.

## Server-owned test price catalogue

The next foundation is `src/server/billing-catalogue.ts`, with an offline `npm run billing:check` command in `apps/web`. Configure `BILLING_PRICE_CATALOGUE` only on the server as JSON with this shape (IDs below are illustrative fixtures, not configured offers):

```json
{
  "version": "approved-test-v1",
  "mode": "test",
  "prices": [
    {
      "priceId": "price_REPLACE",
      "planKey": "GROWTH",
      "currency": "gbp",
      "interval": "month"
    }
  ]
}
```

Allowed plans match the existing catalogue; intervals are `month` or `year`, currency is a lowercase three-letter code. Prices and plan/currency/interval combinations must each be unique. Empty configuration means unconfigured, while malformed or ambiguous configuration fails validation. Only test mode is accepted. This local schema does not verify currencies, amounts, account ownership, active/recurring status or the actual mode of a provider price. Future provider integration must retrieve and verify those details before offering checkout; the local `test` label alone proves none of them.

Exact price lookup rejects unmapped IDs and returns both catalogue version and a canonical content fingerprint. Changing mappings changes the fingerprint even if an operator reuses a version label; entry ordering alone does not. Future durable subscription revisions must retain both identity fields and the resolved mapping. The parser and resolver are foundation utilities, not a webhook handler, checkout endpoint or entitlement mutation. No client request may supply the catalogue. The checker prints identity and mapping count, without configuration contents, and explicitly reports provider verification and checkout as disabled.

No real prices are populated, no provider API is called, and existing assigned-plan access stays unchanged. Subscription storage, provider verification, checkout and lifecycle processing remain subsequent increments.
