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

## Subscription evidence storage foundation

Migration `202609260001_billing_storage` introduces immutable BillingCustomer identity, BillingSubscription identity and append-only BillingSubscriptionRevision records. Customer IDs are unique within provider account/test mode, with one customer binding per organisation/account/mode. Subscription IDs are unique within account/mode and have a composite foreign key tying customer, organisation, account and mode together. Only test-mode customer bindings are accepted; subscription scope inherits that restriction.

Revisions retain raw provider status, price ID, mapped plan, catalogue version/fingerprint, source evidence/hash, observation identity/time and database ingestion time. Provider status is evidence, not a local entitlement decision. Each subscription's observation keys and revision numbers are unique. A database trigger serializes insertion through its parent subscription and requires the exact latest predecessor and next revision. Identity/revision update, delete and truncate are rejected. Historical subscriptions can coexist for the same customer; choosing a current subscription remains future reconciliation logic.

No runtime route or service writes these tables yet. The storage contract does not authenticate webhooks, verify provider prices, compute/check the supplied evidence hash, decide provider-event ordering, change Organisation.planKey or authorize access. Those checks belong to the subsequent trusted writer/webhook integration with atomic audit. The revision sequence describes ingestion lineage only; provider timestamps alone are not proof that an observation supersedes another. Unknown prices must still be rejected before a trusted writer creates a mapped revision.

This migration is tested in temporary databases only. No existing workspace or production migration is applied by this increment. Billing continues to report NOT_CONNECTED because no provider integration is active.

## Audited subscription observation service

`BillingIngestionService.observe` adds an internal owner-authorized observation path for an already-bound local subscription. The injected SubscriptionReader must retrieve authentic current provider state; no HTTP route, Stripe transport, binding creation or webhook adapter is exposed in this increment. The normalized reader contract accepts test mode, a single price with quantity one, and monthly/yearly interval count one. Unsupported shapes fail rather than being silently collapsed.

Before persistence the service matches account, customer, subscription and price-account identities to the retained binding, resolves the server-owned price mapping and checks currency/interval. It computes the evidence hash itself and retains the resolved catalogue identity. Amounts and other commercial terms are not verified because approved offers are not yet supplied; this observation does not authorize checkout or claim paid access.

Every observation key is scoped to its subscription and reused idempotently. Completed retries reauthorize and reuse stored evidence without a provider fetch or catalogue re-resolution. Concurrent duplicate fetches may occur but produce one revision/audit; reader operations must be read-only. Different fetches pin the latest local revision before retrieval. If another observation commits while a fetch is in flight, that fetch is rejected as stale and must retrieve current state again. This is optimistic local ordering, not provider-event ordering or webhook deduplication.

After retrieval, owner membership is rechecked under the organisation lock; revision creation and audit insertion commit atomically. Demotion/revocation or audit failure prevents persistence. Existing identity bindings remain immutable and no organisation plan changes. Provider statuses are retained as evidence only. Real provider transport, signed event receipts, bindings and commercial activation remain subsequent work.

## Stripe read-only test adapter

`StripeSubscriptionReader` implements the internal reader contract using GET requests only. It requires an explicit test secret/restricted key and expected account ID, verifies the key's own account with `/v1/account` (no Connect account header), then retrieves the bound subscription and its price. The API version is pinned to `2024-06-20`. References: [subscription retrieval](https://docs.stripe.com/api/subscriptions/retrieve?api-version=2024-06-20), [price retrieval](https://docs.stripe.com/api/prices/retrieve?api-version=2024-06-20) and [Stripe account retrieval](https://docs.stripe.com/api/accounts/retrieve?api-version=2024-06-20).

Both subscription and price must be test-mode objects; the subscription must have exactly one item, quantity one and no additional item page. Prices must be recurring, per-unit, licensed and monthly/yearly with interval count one and no quantity transformation. Account/subscription/price identities, embedded versus retrieved currency and interval must agree. Other shapes fail explicitly. Customer identity and catalogue matching remain independently enforced by ingestion.

Each GET has a 15-second abort deadline and a streamed 1 MB response cap regardless of Content-Length. Redirects are rejected, caching disabled, errors sanitized and automatic retries omitted. Extra Stripe fields are discarded by normalization. There is no endpoint override, environment auto-activation, real credential configuration, checkout write or webhook connection in this increment.

The adapter observes existing subscriptions, including those whose prices may be archived. It does not certify a price as available for a new checkout, compare amounts to approved commercial terms, establish paid entitlement from status, or verify lifecycle decisions. Those remain activation requirements. Tests use injected HTTP responses only; real-account acceptance is not established.

## Signed test webhook inbox

`POST /api/stripe/webhook` is a receipt-only Node route, disabled unless STRIPE_WEBHOOK_RECEIPTS_ENABLED is exactly true and STRIPE_TEST_WEBHOOK_SECRET / STRIPE_TEST_ACCOUNT_ID are supplied. Deploy its migration before enabling; do not register it as an active commercial integration until a consumer is ready. It uses endpoint signatures instead of session/Origin authentication. Other application routes retain their existing authentication.

Signature verification follows [Stripe's manual verification protocol](https://docs.stripe.com/webhooks?verify=verify-manually): HMAC-SHA256 over timestamp, a dot and the unchanged raw body; constant-time v1 comparison; a five-minute past/future delivery-time window. Multiple v1 signatures allow a rotated endpoint secret; v0 is ignored. Duplicate/ambiguous timestamps fail. A 256 KiB streamed cap applies independent of Content-Length. Only test-mode direct-account events are accepted; Connect events are rejected. The configured account must belong to the endpoint secret; deployment must verify this pairing because direct-account events do not attest account ownership in the body.

`BillingWebhookReceipt` is an immutable inbox keyed by account/mode/event ID. It retains type, event time, receipt time, full parsed-payload hash and subscription/customer IDs for supported customer.subscription.created/updated/deleted events. It discards raw payloads, metadata and personal fields. Other event types have no inferred subscription routing. Metadata never establishes tenant ownership. Supported event data must contain test-mode subscription identity; a future consumer must resolve the existing account/customer/subscription binding rather than trust metadata.

Only a committed receipt yields 200. Persistence failures yield 500 so delivery can retry. Concurrent duplicate deliveries reuse the unique receipt; the same event ID with different content yields 409. Semantically identical JSON with reordered keys uses the canonical hash. Older-created events remain recorded independently; event creation timestamps never determine entitlement order. Update/delete/truncate are prohibited.

This milestone acknowledges delivery, not processing. It does not run subscription observation, grant access, establish payment, recover unmatched tenant bindings, or reconcile invoices. A durable worker with processing outcomes/retries, current-state retrieval and scoped binding checks remains the next increment. No Stripe endpoint, secret or app database migration was configured/applied during development.

## Owner-operated durable reconciliation worker

`npm run billing:reconcile -- <organisation-id> <verified-owner-id>` runs one bounded pass (up to 20 due receipts) for that workspace. It requires BILLING_PRICE_CATALOGUE, STRIPE_TEST_SECRET_KEY and STRIPE_TEST_ACCOUNT_ID and the storage/receipt/job migrations. It is not automatically scheduled or exposed over HTTP. Exit 0 means selected jobs succeeded or none were due; 2 indicates selected jobs remain non-successful; 1 indicates a configuration/access/runtime failure. An empty pass does not certify that the entire inbox is processed. No real command execution/provider call was performed during this implementation.

`BillingReconciliationJob` binds one receipt to its existing account/mode/customer/subscription/organisation identity. The database checks this binding; event metadata never supplies a tenant. Unsupported or unbound receipts remain in the inbox and are not silently attributed, acknowledged as processed or used to create subscriptions. The scan ignores them until a separate binding/support decision is made.

Claims serialize under the organisation lock, recheck owner access and carry a unique token with a two-minute lease. Failures retain a sanitized code and attempt count and become due after 60 seconds, doubling to a one-hour maximum. Expired leases can be reclaimed. Completion/retry writes require the worker's lease token, so an older worker cannot overwrite a newer claim. Successful jobs are immutable, and their revision must have the exact receipt observation key and subscription scope. Job bindings cannot change or be deleted/truncated.

Each receipt uses stable observation key `receipt:<receipt UUID>` with the existing audited ingestion service. It retrieves current provider state, not the event's old snapshot; creation timestamps are never treated as provider ordering. A local revision change during retrieval triggers retry. Revision and audit remain atomic. Job completion is a separate recoverable checkpoint: after a crash, an already committed observation is reused without another provider fetch or revision. Provider reads themselves may repeat after a crash/lease expiry, but no payment writes occur.

This worker deliberately requires an explicit current owner actor, including before/after provider retrieval via ingestion. It does not impersonate an owner or invent a system user. Automated system-principal scheduling remains future work. It preserves the original assigned plan and does not apply payment/grace/cancellation entitlements. Per-attempt history is not separately retained: the durable job holds current status, last code and cumulative attempts; successful evidence/audit is immutable.

## Reviewed operator binding

`npm run billing:bind -- <reviewed-binding.json>` links an existing Stripe test subscription to a workspace. The bounded (16 KiB) manifest contains organisationId, ownerUserId, accountId, customerId, subscriptionId and reviewReference (10–500 characters). Use real reviewed IDs; never include secret keys in the manifest. The account must match STRIPE_TEST_ACCOUNT_ID. Required server configuration is STRIPE_TEST_SECRET_KEY and BILLING_PRICE_CATALOGUE. This command writes local binding/evidence/audit rows and makes only provider GET calls; it never creates a Stripe customer or subscription.

This is a trusted operator CLI, not an HTTP/self-service endpoint. The operator must independently verify the customer/workspace association and supply its review reference. Stripe identity checks prove the subscription's account/customer relationship, not which application workspace owns that customer. Supplying a known provider ID or metadata must never become sufficient proof of ownership in a future public flow. Future checkout must establish that association server-side.

The service checks current Owner membership before fetching and again before writing. The normalized provider snapshot must match all reviewed identities and the catalogue currency/interval. A provider-account advisory lock plus organisation lock protects concurrent bindings across workspaces. Existing customer/subscription identities cannot be reassigned; a workspace cannot silently replace its account's customer. Identical bindings are reused without new revisions or audit events, after fresh provider/access checks. Reuse does not refresh state; run reconciliation for current observations.

New customer, subscription, first hashed observation and review-reference audit commit in one transaction. A failure rolls back all of them. The first revision uses `binding:<local subscription UUID>`, preserves the catalogue identity and leaves Organisation.planKey unchanged. No migration beyond the existing billing schema is needed.

On 26 September, a presence-only configuration check found the test secret key, account ID, webhook secret and price catalogue unset. No secret values were printed. Real-account acceptance is therefore blocked on configuration and reviewed test identities; simulated tests do not close it.

## Retained report snapshots

Reports now supports explicit retention of an energy, baseline or savings preview and paginated retrieval of retained JSON/CSV. This is the archive foundation for scheduled reporting; cadence, recipients, scheduler identity and delivery remain open. Opportunity reports are not included in this first archive slice.

Owners, Admins and Analysts can retain previews. The server regenerates from a strict report definition and requires the exact preview fingerprint; changed evidence returns REPORT_CHANGED. It never accepts client-supplied report JSON. Stable request keys prevent duplicate archives on retry, including after source data changes. Each archive preserves the complete report contract, evidence, units, status and validation labels. Downloads read this immutable snapshot rather than regenerate it. They verify the fingerprint and recheck current membership and site assignments, including access to archived sites. Authorized site readers share archive access; authorship is provenance rather than private ownership.

Capture and download audits are transactional. Tenant-scoped site foreign keys, evidence checks and immutable update/delete/truncate guards protect persisted records. History uses scoped 25-item cursor pages ordered by creation time and ID. The Reports panel is scoped to the selected site and explicitly loads history; it does not silently schedule or email reports.

Deployment requires migration 202609260004_report_archives (and preceding migrations). Development validation applies migrations only to isolated test databases. No production deployment is included.
