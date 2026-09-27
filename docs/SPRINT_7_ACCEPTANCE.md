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

## Scheduled-report eligibility preflight

Added a read-only internal eligibility service for pinned retained reports and recipient membership IDs. The isolated PostgreSQL suite passed current-plan checks, owner demotion/revocation, foreign workspace/site/archive rejection, fingerprint mismatch, empty/duplicate/oversized recipient input, recipient revocation, assignment removal, unauthenticated recipients and password-only login support. It confirms no mail or preflight audit writes, and historical report access after downgrade. The suite is included in test:integration.

TypeScript, focused ESLint, formatting and diff checks passed. No migration, application data mutation, public endpoint or UI change is included; a browser rerun was unnecessary for this unconnected server service. ELIGIBLE_NOW is a point-in-time finding, not permission to send later. Durable schedule revisions, occurrence claims/retries, immediate pre-send authorization and approved delivery policy remain open.

## Durable schedule drafts and held jobs

Added internal schedule revision and occurrence-preparation services plus migration 202609260005_report_schedules. Isolated PostgreSQL tests passed concurrent request deduplication, competing edits, stale revision rejection, distinct UTC occurrences across the London fall-back hour, recipient revalidation, creator/tenant boundaries, automatic superseded-job cancellation, audit rollback for revisions and jobs, immutable records, database-only invalid lineage/scope/null-recipient attempts, forbidden running states and terminal cancellation. Cancellation was verified after plan downgrade, site archival, recipient revocation and creator role demotion. The earlier eligibility integration suite also passed after extracting its transaction-aware check.

TypeScript, focused ESLint, formatting and diff checks passed. Migration application occurred only in disposable databases. No API/UI, browser behavior, cadence, provider call or email delivery is activated. HELD is preparation, not successful delivery. Execution claims, attempt outcomes/retries and provider ambiguity remain open.

## Schedule management API acceptance

Added authenticated draft mutations, occurrence preparation and private paginated list/detail/revision/job reads. Extended isolated PostgreSQL coverage passed 27-schedule and 27-revision pagination, 26 equal-time jobs, owner isolation, foreign/wrong-schedule cursors, omission of request keys/hashes, management reads after downgrade/demotion and revocation checks.

The new browser/HTTP scenario passed against a disposable database (47.2 seconds including startup). It exercises unauthenticated reads, foreign-origin rejection, real archive capture, draft creation/retry, detail/list/history, invalid cursors/UUIDs, held-job preparation, revision edits, stale conflicts, automatic job cancellation, terminal cancellation, no-store headers, hidden request metadata and rejection of activation/send requests. TypeScript, focused ESLint, formatting and diff checks passed. No application database migration, production deployment, schedule UI or delivery transport was enabled.

## Schedule management UI acceptance

Added the site-scoped Reports panel for draft creation/editing/cancellation, permission-aware recipient choices, paginated retained-report choices and schedule/revision/job history, and explicitly labelled UTC held occurrences. The browser/HTTP test passed the full flow: create from an archive, prepare a held occurrence and clear its field, edit and observe cancellation of old jobs, reload persisted settings, encounter a concurrent revision conflict, reload the current revision, cancel and verify disabled editing. It also confirms no horizontal overflow at 390 px. Final run passed in 1.1 minutes including startup.

Reviewed the mobile screenshot and applied the existing compact checkbox styling. An explicit label association fixes dropdown discovery. TypeScript, focused ESLint, formatting and diff checks passed. The existing database/service acceptance remains applicable; no server schema or mutation logic changed in this UI increment. No application migration or production deployment occurred. Automatic scheduling and email remain disabled.

## Delivery-readiness worker acceptance

Added durable readiness-check claims and terminal outcomes, without a transport or scheduler. The isolated PostgreSQL worker suite covers competing claims, future occurrences, request-key reuse, lease recovery, stale tokens, revoked recipients/creator, wrong owner/job tokens, plan downgrade, schedule cancellation during a claim, audit rollback and immutable results. Schedule integration regression also passed against the new migration. The worker leaves occurrence jobs HELD or CANCELLED and never emits mail.

TypeScript, focused ESLint, formatting and diff checks passed. Migration 202609260006_report_delivery_checks was applied only to disposable databases. No UI, public route or runtime activation changed, so no browser rerun was needed. Readiness is explicitly READY_NO_SEND rather than delivery success; actual provider attempts, approved retries and ambiguous-send handling remain open.

## Readiness-check history acceptance

Added a creator-scoped per-job history endpoint and report-panel history with refresh and pagination. Isolated database checks passed wrong-owner/workspace/site/schedule/job cursor rejection, revoked membership denial and omission of tokens/request keys. The browser/HTTP test passed 28 persisted checks over two pages, unique results, refresh, ready-not-sent/blocked/interrupted/expired-pending labels, unauthorized GET rejection, invalid cursor rejection, unsupported POST rejection and no-store responses. The mobile layout has no horizontal overflow. Final browser run passed in 1.3 minutes including startup.

TypeScript, focused ESLint, formatting and diff checks passed. Expiry display uses the server response timestamp. No new schema migration, application database migration, worker activation or email transport is included in this increment. Existing schedule and delivery-check migrations are still prerequisites for the app database.

## Controlled readiness execution acceptance

Added strict per-job POST checks and Run readiness check / Recover and recheck controls. Database integration passed creator/full-path enforcement, rejection of caller-supplied tokens, cancelled-job handling and projected responses. The browser/HTTP scenario passed expired-check recovery with one new result, retry idempotency, explicit manual reruns, NOT_DUE future jobs, invalid schedule/job combinations, unauthenticated requests, foreign-origin rejection and response secret omission. Final browser run passed in 1.4 minutes including startup.

TypeScript, focused ESLint, formatting and diff checks passed. The endpoint invokes readiness validation only; no mail transport, recurring scheduler, commercial activation, app database migration or deployment occurred. Existing schedule/check migrations remain prerequisites for the app database.

## Manual retained-report access acceptance

User selected manual delivery; recurrence and report email remain deferred. Added a protected immutable snapshot page, Open retained report links and restricted login callbacks that preserve the exact snapshot destination. Archive views have a separate atomic audit action from downloads.

Validation passed: 15 callback allowlist/rejection unit tests; isolated archive integration including view audit and denied view access; existing schedule browser regression; focused manual-link browser flow covering password sign-in return, authorized viewing/downloads, anonymous API denial, revocation, cross-site denial, multiple retained reports and mobile overflow. The mobile screenshot was visually reviewed. An initial list assertion incorrectly assumed the target archive was newest; the corrected exact-link assertion passed with an additional newer archive. A terminated rerun left an orphaned test server, which was stopped before the successful focused run (36.6 seconds of test execution).

TypeScript, focused lint, formatting and diff checks passed. No new schema migration or report delivery activation is included. Existing app database migrations remain pending; test databases were disposable.

## Local development database activation — 26 September 2026

Confirmed the configured target is the local `energiepad_v2` database at `127.0.0.1:55432`. Started its existing persistent PostgreSQL service and applied the six pending migrations from billing storage through report delivery checks (`202609260001`–`202609260006`) using `prisma migrate deploy`. No database reset, seed, production connection or provider activation was performed.

Post-migration verification: Prisma reports all 38 migrations applied and the schema up to date. All 10 new billing/report tables are readable. Counts for all 57 pre-existing application tables match the pre-migration snapshot. This verifies local schema availability and unchanged row counts, not a new full application regression or production acceptance. The local service is running; manual report delivery remains the selected scope.

## Combined Sprint 7 regression — 26 September 2026

Fresh validation of the combined implementation passed:

- All 389 unit tests across 48 files.
- Full application ESLint and Prettier checks.
- Five isolated PostgreSQL suites: billing storage/ingestion/bindings/reconciliation, report archives, delivery eligibility, schedule revisions/jobs, and readiness worker/recovery.
- All three Sprint 7 browser workflows in one run: assigned-plan billing, schedule management/readiness, and manual retained-report links (2.2 minutes including startup).
- Production build, including TypeScript and static page generation.

The initial sandboxed build failed reading TypeScript CLI output. An unrestricted retry overlapped with browser startup and encountered disappearing generated E2E type files. The final unrestricted build ran after browser shutdown and passed. Run builds and browser tests sequentially in this checkout, as the CI workflow already does.

This is targeted Sprint 7 acceptance plus the full unit suite, not a rerun of every earlier sprint's integration/browser tests. Database and browser fixtures used disposable databases. No provider activation, production deployment or automatic delivery was performed. The current acceptance gates are summarized at the top of SPRINT_7_DESIGN.md; Sprint 7 remains partially complete pending commercial decisions and real-provider acceptance.
