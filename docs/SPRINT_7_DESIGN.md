# Sprint 7 — commercial foundations

Sprint 7 begins with an owner-only plan and usage overview. Independent commercial work can proceed while Sprint 6's methodological approval and deferred OpenAI acceptance remain open. This does not mark those gates accepted.

## Current scope and acceptance gates — 26 September 2026

The sections below describe successive increments; statements such as “no endpoint yet” or “temporary databases only” describe the state at that increment. The management/readiness endpoints and manual retained-report pages now exist, and all six billing/report migrations have been applied to the local development database. Production application of those migrations remains outstanding.

| Area                                                         | Current state                                                  | Next prerequisite                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Assigned-plan billing and provider evidence                  | Implemented with test adapters and isolated acceptance         | Real Stripe test configuration and reviewed bindings                        |
| Checkout, customer portal and subscription-based access      | Not implemented or enabled                                     | Approved offers and lifecycle decisions in SPRINT_7_COMMERCIAL_DECISIONS.md |
| Retained reports                                             | Manual authenticated viewing and JSON/CSV download implemented | Production rollout acceptance when deployment is requested                  |
| Schedule drafts and readiness checks                         | Explicit manual preparation/checking only; no sends            | No automatic-delivery work until the user resumes it                        |
| Automatic report delivery                                    | Deferred by user                                               | Explicit request to resume and delivery policy decisions                    |
| Live AI, savings verification and real-source reconciliation | Separate unresolved/deferred gates                             | See PRE_SPRINT_7_REVIEW.md and its follow-ups                               |

Passing local regression checks does not close the commercial lifecycle gate or accept Sprint 7 in full. Continue requests alone do not approve prices, entitlement cutoffs, automatic delivery or live-provider activation.

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

## Scheduled-report delivery eligibility

The internal ReportDeliveryEligibilityService provides a read-only preflight for a proposed schedule owner, a site, one retained archive/fingerprint and a bounded list of recipient membership IDs. In one repeatable-read snapshot it verifies current analysis-write permission, assigned-plan scheduledReports inclusion, an active site, archive scope/integrity and every recipient's current tenant membership and site assignment. Missing, foreign, revoked or unassigned recipients reject the entire selection without identifying individual failures. Password-only accounts remain supported under existing authentication rules.

The result explicitly says ELIGIBLE_NOW and delivery DISABLED. It is not a token, durable authorization, evidence of consent or email-deliverability approval. No recipient addresses, report data or mail are emitted, and the preflight writes no records. The 100-recipient input bound is a technical work limit, not an approved commercial allowance. No HTTP endpoint or runtime scheduler uses it yet.

A future worker must call this check immediately before each delivery attempt and additionally verify the persisted schedule revision, active state, occurrence claim, approved limits/channel and recipient policy. An earlier successful preflight cannot survive revocation or authorize a later retry. This increment does not solve the external-send/authorization race or exactly-once delivery; durable jobs, claim recovery, revision cancellation and provider idempotency remain required. Archived reports remain available through their existing read endpoint after a plan downgrade or site archival, while new scheduled delivery eligibility is denied.

## Durable schedule drafts and held occurrences

ReportScheduleService adds internal draft creation/editing, terminal cancellation and explicit UTC occurrence preparation. It exposes no HTTP endpoint, scheduler or mail transport. A schedule retains its creator membership and site identity. Each immutable revision pins an existing archive/fingerprint, sorted distinct recipient membership IDs and a canonical timezone. No recurring cadence is inferred: occurrence preparation accepts an explicit UTC timestamp with millisecond precision. Two instants within a repeated daylight-saving hour remain separate jobs.

Draft writes and preparation recheck the shared eligibility rules inside the write transaction, under the workspace lock. A request key/hash deduplicates revisions; edits require the latest revision ID. Concurrent conflicting edits return SCHEDULE_CHANGED, while identical retries reuse the original revision. Returning a prior revision after a later edit is a receipt for the earlier operation, not a rollback or reactivation. Schedule management is currently limited to its creator. A current creator membership may cancel after role demotion, plan downgrade, site archival or recipient revocation; revoked creators cannot use the service. Administrative takeover remains future work.

ReportDeliveryJob is unique per revision and occurrenceAt and starts HELD. Inserting a newer revision atomically cancels older held jobs through a database trigger; terminal cancellation cannot be reopened. Scope foreign keys bind schedules, archives and jobs to the same workspace/site; database guards enforce lineage, distinct workspace recipients, immutable identities/revisions and held-only job transitions. Writes and audits are atomic, so an audit failure also rolls back cancellation of old jobs. Job deletion/truncation and history mutation are rejected.

Migration 202609260005_report_schedules is required and has been tested only on temporary databases. These rows are preparation records, not sent reports, active subscriptions or delivery approval. Next: schedule management/read APIs and the durable execution/attempt lifecycle, including leases, authorization before each send, retries and ambiguous provider outcomes. Cadence, recipient/channel rules and commercial limits still require decisions before activation. No automatic delivery is enabled.

## Schedule management HTTP API

The authenticated API now exposes the draft service under `/api/v1/organisations/:org/sites/:site/report-schedules`. Every response explicitly identifies delivery as DISABLED. Mutation routes use the existing same-origin, session-authenticated JSON handler and 16 KiB body limit. No send or activation endpoint exists.

| Method and suffix      | Behavior                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| GET collection         | Creator-owned schedule list with latest revision and optional cursor                       |
| POST collection        | DRAFT create/edit or CANCEL action using the existing strict request-key/revision contract |
| GET /:schedule         | Creator-owned identity and latest revision                                                 |
| GET /:schedule/history | Immutable revision history, optional cursor                                                |
| GET /:schedule/jobs    | HELD/CANCELLED occurrence jobs, optional cursor                                            |
| POST /:schedule/jobs   | Prepare an explicitly timed UTC occurrence for the current draft                           |

Read pages contain at most 25 items and nextCursor. List ordering is creation time descending with ID tie-break; revision history is revision descending; jobs use occurrence time descending with ID tie-break. Cursors must belong to the exact creator/workspace/site/schedule scope for their endpoint. Reads recheck active membership each time. Another workspace member, including an Owner, cannot inspect someone else's schedule through these routes. Current creators can still inspect/cancel their own drafts after demotion, downgrade or site archival; these management responses contain snapshot references and recipient membership IDs, not report bodies or email addresses. Existing report downloads independently enforce current report access.

Request keys and request hashes are omitted from HTTP revision responses. Mutation retries retain their prior-operation semantics; edit responses do not imply that a historical idempotent result is still the latest revision. Clients should reload the detail endpoint after a conflict or retry when displaying current state. All API responses retain the shared no-store header. The app database still requires the schedule migration before these endpoints can be used. This increment adds no UI or delivery worker.

## Reports schedule management panel

Reports now includes a site-scoped schedule panel with explicit refresh and pagination, draft creation/editing against retained snapshots, revision history, held occurrence history and terminal cancellation. Snapshot choices are loaded from the retained-report API, preserving the selected fingerprint. Stable request keys are retained across failed saves; successful saves reload current detail. Conflicts keep the form available and offer an explicit reload rather than silently overwriting a newer revision. Switching sites remounts the panel so old requests cannot update the new site's controls.

Recipient labels use the existing member-management permission: team managers receive the current member list, with site managers filtered by assignment to the selected site; other users get their own membership only. Previously selected IDs unavailable to the picker remain visible as unavailable entries and are never silently dropped. Every write still uses server-side eligibility checks. Plan/writer/site eligibility controls new/edit forms, while creator history and cancellation remain available through the panel for selectable sites.

Occurrence input is explicitly labelled UTC and converted by appending Z, independent of the browser timezone or saved schedule timezone. It creates HELD records only and clears after success. Changing a draft shows superseded jobs as CANCELLED; cancelling disables further edits/preparation. All copy states that automatic scheduling and email are disabled. No cadence controls or delivery claims are introduced. The existing schedule migration must be applied to the app database before using the panel.

## Durable delivery-readiness worker

ReportDeliveryWorker adds an internal, unscheduled readiness rehearsal for explicitly selected occurrence jobs. It has no mail transport, runtime singleton, HTTP mutation endpoint or automatic activation. Jobs remain HELD: READY_NO_SEND is a point-in-time validation result, never a delivered report or reusable permission to send.

Each job has sequential durable ReportDeliveryCheck attempts, an idempotency key, a unique claim token and a two-minute lease. Only one CHECKING attempt can exist per job. A current creator with analysis-write access can claim a due held job. Another claim returns BUSY; future jobs return NOT_DUE. Repeating a request key returns its earlier attempt without a new check. Retrying with a fresh key after lease expiry atomically records INTERRUPTED and a new claim. Terminal records cannot be changed, deleted or truncated.

Completion checks the original creator identity and token, current schedule revision, job cancellation, plan, site and all recipient permissions. The final lease time is rechecked before committing. A claimed worker can record BLOCKED after its creator loses access, but receives no report content or recipient addresses. Old/finished tokens cannot replace newer results. Unexpected database errors roll back; finalization and its audit commit together. Known eligibility failures record sanitized codes. Cancellation or revision changes prevent READY_NO_SEND.

Migration 202609260006_report_delivery_checks is tested only in temporary databases. This is not a provider retry policy or commercial quota: there is no batch daemon, automatic retry/backoff, recipient send, delivered state or claim of exactly-once delivery. An abandoned check whose creator remains unauthorized needs later operator recovery design; a running token can still record a blocked result. Next: expose check history for operators and define execution activation, recurrence, provider idempotency and ambiguous-send reconciliation before connecting any email transport.

## Readiness-check history visibility

Creators can inspect each occurrence's readiness checks from the Reports schedule panel. GET `/api/v1/organisations/:org/sites/:site/report-schedules/:schedule/jobs/:job/checks` returns at most 25 checks, ordered by descending attempt number, with a job-scoped cursor. It checks current creator membership and the full workspace/site/schedule/job chain. Tokens and request keys are excluded by an explicit select. The endpoint is read-only, no-store and always reports delivery DISABLED.

The UI offers refresh and older pages, identifies ready results as “Ready — not sent,” and explains blocked/interrupted results. CHECKING attempts whose lease has expired are labelled recovery pending, without rewriting their stored status or claiming recovery happened. Expiry display uses the server response time, avoiding dependence on the browser clock, and updates on refresh. Check selection resets when opening another schedule or starting a draft; site changes remount the whole panel. Past readiness never authorizes a later send. This increment adds no worker-trigger control or mail transport.

## Controlled readiness execution and recovery

POST to the per-job `/checks` endpoint now accepts only `{ requestKey }`. It invokes the readiness worker for the current authenticated creator, requires analysis-write permission and verifies the complete workspace/site/schedule/job path. It does not accept actor IDs, tokens, destinations or provider parameters. The response explicitly projects only status/code and delivery DISABLED, including on idempotent retries; lease tokens and request keys never leave the server. Active membership is checked again before returning.

The schedule panel offers Run readiness check and, for an observed expired claim, Recover and recheck. One invocation processes one selected job, never a batch or recurring task. A fresh request after expiry closes the old check as INTERRUPTED and can create a new readiness attempt. The UI retains a request key across failed requests until a response and history refresh succeed, then uses a fresh key for a deliberate new check. Repeating a key returns its recorded outcome; an in-progress retry reports CHECKING, not a second worker.

Future occurrences return NOT_DUE; busy jobs report BUSY; cancelled jobs cannot create new checks. Recovery of an expired cancelled job can close its stale check without starting another. Current plan/site/recipient eligibility is evaluated by completion and may produce BLOCKED. An authorized creator is still required to start/recover checks; this does not add administrative takeover for revoked creators. Existing readable history remains independent of write eligibility.

No provider is called, no report is sent, no recurring scheduler runs and no HELD job becomes delivered. This activation is limited to explicit readiness checks. Commercial cadence/recipient policy, actual provider submissions, retry/backoff and ambiguous-send reconciliation remain open.

## Manual retained-report access

The user chose to keep delivery manual. Retained snapshots now have a protected page at `/retained-reports/:org/:site/:archive`, reachable from Open retained report in archive history. This page shows the immutable stored summary, status, units and expandable full evidence, with the existing authorized JSON/CSV downloads. It uses current membership/site checks and an integrity check; possessing the URL does not grant access. No email, scheduled send or public bearer link is created.

The page sits outside the workspace layout so its exact return path can survive sign-in. Password and email-link login accept only the existing invitation paths and strictly shaped retained-report paths; arbitrary URLs, query strings, fragments, whitespace and encoded paths are rejected. Authentication return-path validation does not replace archive authorization. Page views use report.archive_viewed auditing, distinct from report.archive_downloaded; browser link prefetch is disabled to avoid eager view audits.

This change introduces no schema migration and uses the existing archive storage. The user's manual-delivery decision supersedes plans to activate recurring/email delivery until requested.
