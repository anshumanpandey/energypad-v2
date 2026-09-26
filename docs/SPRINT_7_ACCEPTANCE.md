# Sprint 7 acceptance record

Status: in progress. The first increment delivers a read-only, owner-only assigned-plan and usage overview. Subscription lifecycle, Stripe, effective billing-state entitlements, commercial quotas and scheduled reports remain open.

## Delivered

- Billing page with assigned plan, active-site usage, remaining/unlimited capacity and explicit over-limit status.
- Plan inclusion labels distinguish entitlements from feature availability and paid-subscription state.
- Owner-scoped GET billing API; current membership checks on every read.
- One consistent transaction for plan and capacity reads; archived sites excluded.
- No prices, subscription dates, trial claims or payment actions inferred from the assigned plan.

## Acceptance coverage

Foundation integration covers every non-owner role, cross-tenant requests, membership revocation, archived sites, unlimited plans, plan changes and over-limit capacity. The browser test covers account/workspace creation, owner navigation, live capacity after site creation/archive, the read-only subscription notice, mobile overflow and signed-out API rejection.

Commercial lifecycle acceptance is not established by these checks. See SPRINT_7_DESIGN.md for the remaining sequence and required decisions. Sprint 6 methodology approval and deferred OpenAI acceptance remain separate.

Validation: all 11 foundation PostgreSQL integration scenarios, the dedicated billing browser workflow, typecheck, lint, formatting and diff checks passed. Mobile layout was visually inspected. No full unit-suite rerun was needed for this read-only increment; the preceding 304-test baseline remains recorded under Sprint 6. No production deployment or external billing/AI calls occurred.

## Assigned-plan policy foundation

Billing, site creation/import and AI eligibility now resolve the same versioned local-assignment policy. Shared capacity rules preserve persisted overrides and existing feature inclusion. Unit coverage checks all plan feature tiers, exact and batch boundaries, unlimited/zero capacity, over-limit behavior, malformed/unknown configuration and mutation isolation. No commercial subscription status or new billing quota is inferred.

Validation for this increment: 313 unit tests across 43 files, all 11 foundation and 9 site/import PostgreSQL scenarios, and the analysis integration suite (including fake-provider entitlement/cap checks) passed. Typecheck and lint passed. Tests used isolated databases; no live provider calls or production changes occurred.

## Test price catalogue foundation

Added strict server-owned catalogue parsing, immutable mappings, exact price lookup, version/content fingerprints and an offline `billing:check` command. Unit coverage rejects live mode, unknown plans, duplicate prices/offers, malformed fields, unknown fields and oversized configuration; it checks absent configuration, unmapped prices, stable ordering and changed-mapping fingerprints. No real offers or provider verification are implied. Durable subscription state and Stripe integration remain open.

Catalogue validation: 329 unit tests across 44 files and typecheck passed. The checker was exercised with absent, valid fixture and malformed configuration; malformed configuration exits with status 1 without echoing its contents. No database or browser behavior changed in this increment.

## Subscription evidence storage

Added test-mode tenant/account-bound customer and subscription identities plus immutable, sequential subscription evidence revisions. The isolated database test exercises cross-tenant/account rejection, duplicate identities and observation keys, invalid initial/branched lineage, concurrent next revisions, immutable records/truncate protection and unchanged assigned-plan access. It is included in the regular integration command. Provider verification, authenticated/audited writes, event reconciliation and effective subscription access remain open. No runtime activation or application/production database migration occurred.

Validation: Prisma schema validation, typecheck, focused lint/format checks, the new storage integration test and all 11 foundation PostgreSQL scenarios passed. The migration was applied successfully to isolated databases. No full unit or browser rerun was needed for this unused storage-only increment; no UI behavior changed.

## Audited subscription observations

Added an internal service using an injected current-state reader, strict normalized test-mode evidence, retained identity checks, exact catalogue mapping/currency/interval validation, computed evidence hashes, idempotent observation keys and atomic revision/audit writes. The database integration checks wrong provider identities and price terms, unknown prices, private workspace access, retries, duplicate observations, stale in-flight fetches, demotion during retrieval and audit rollback. Assigned-plan access remains unchanged. No live provider or route is connected.

Validation: extended billing storage/ingestion PostgreSQL integration passed in an isolated database; typecheck, focused ESLint, formatting and diff checks passed. No application database migration, UI change, external provider call or deployment occurred.

## Stripe read-only adapter

Added GET-only test-account/subscription/price retrieval with pinned API version, identity/mode/shape validation, timeout, streamed response cap, redirect rejection and sanitized errors. Mock HTTP tests cover successful normalization, wrong account/IDs/currency, live mode, missing/paged/multiple-quantity items, unsupported price intervals/usage/billing schemes, authentication/rate-limit/server errors, malformed/oversized responses and request abortion. No credentials or live account were used; no route/payment behavior changed. Amount approval, checkout availability and signed webhook processing remain open.

Validation: 348 unit tests across 45 files, typecheck, focused lint/formatting and diff checks passed. No database/browser rerun was needed for this unconnected read-only transport. No network calls to a Stripe account, migration or deployment occurred.

## Signed webhook receipt inbox

Added disabled-by-default receipt-only endpoint, raw-body HMAC verification, strict test/direct-account envelope handling, streamed size limits and durable immutable event receipts. Unit tests cover signature tampering, age/future bounds, rotation signatures, malformed headers, live/Connect rejection, unsupported-event routing, exact byte forwarding, persistence failure responses and overflow. Database coverage exercises concurrent duplicate delivery, reused-ID conflicts, out-of-order retention and immutability. Receipt acceptance is not subscription processing; the reconciliation worker remains open.

Validation: all 366 unit tests, the extended billing PostgreSQL integration suite, typecheck, focused lint/formatting and diff checks passed. The receipt migration was applied only to isolated test databases. No external webhook registration, real credential use or production deployment occurred.

## Durable receipt reconciliation

Added owner-scoped one-pass worker/CLI and durable receipt jobs with two-minute token claims, capped exponential retry delays, expired-claim recovery and immutable successful outcomes. Database guards tie jobs to matching receipt/customer/account/subscription/workspace identities and completions to exact receipt observations. A stable observation key recovers a revision committed before a job-completion crash. Current provider retrieval prevents a late delivery from replaying an older snapshot. No access changes or automatic scheduling are enabled.

Validation: extended isolated billing PostgreSQL suite passed, including wrong-customer binding, concurrent claims, delayed retry, expired lease, completion-failure recovery without duplicate revision/provider fetch, late delivery using current canceled state, and demoted-owner denial. Typecheck, focused lint/formatting and diff checks passed. Migration was applied only in temporary databases; no live Stripe calls, app database migration or production deployment occurred.

## Verified operator binding workflow

Added bounded reviewed-manifest CLI and binding service for existing test subscriptions. It validates provider account/customer/subscription and mapped currency/interval, rechecks Owner access after retrieval, prevents cross-workspace reassignment, and atomically stores binding/initial observation/audit. Concurrent and repeated identical bindings reuse the existing identity. This is operator-only: the review reference records the operator's association decision; provider validation is not proof of workspace ownership for arbitrary callers.

Real test-account acceptance remains blocked: presence-only checks found no configured test key, account ID, webhook secret or price catalogue. No real provider request, binding, migration or deployment was performed.

Validation: extended billing PostgreSQL suite passed with verified binding checks, concurrent identical reuse, cross-workspace and replacement-customer rejection, pre/post-fetch permission enforcement and full rollback on audit failure. Typecheck, focused lint/formatting and diff checks passed. An initial Prisma void-return incompatibility in the advisory-lock query was corrected and the database suite rerun successfully. Real-account acceptance remains unexecuted.

## Test-account readiness gate

Added offline `billing:readiness` with explicit missing/invalid/disabled states and nonzero exit codes, plus STRIPE_TEST_ACCEPTANCE.md for the real-account procedure. Syntax-complete configuration is explicitly separate from provider verification, deployed schema, reviewed bindings, signed delivery and commercial approval. The current check reports all four prerequisite values missing and webhook receipts disabled. Eight focused tests and typecheck passed, including invalid/live-key rejection and secret-free output. No provider/database calls were made by the checker.

## Retained report snapshots

Added immutable preview retention, tenant/site-scoped paginated history and audited JSON/CSV downloads for energy, baseline and savings reports. The database suite verifies exact historical values after source changes, concurrent idempotent retention, changed-preview rejection, conflicting request keys, pagination with tied timestamps, cross-site denial, role/revocation checks, access to archived sites, atomic audit rollback and update/delete/truncate rejection.

Validation: isolated PostgreSQL archive integration, TypeScript, focused ESLint, formatting and the full analysis browser scenario passed. The browser scenario retains the preview and downloads its JSON, then checks existing report exports and AI evidence flows. Its first run caught a doubled API prefix in the new panel; the corrected relative form-helper path and absolute download links passed the rerun (4.0 minutes). Migrations have only been applied to isolated databases. Scheduled execution, recipients and email delivery remain open, as does real Stripe acceptance.
