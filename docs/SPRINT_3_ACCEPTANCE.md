# Sprint 3 progress and verification

Status: **in progress**. Energy imports, drivers, weather jobs and audited corrections are implemented; full legacy parity is not yet met. See [SPRINT_3_AUDIT.md](SPRINT_3_AUDIT.md) for the consolidated audit. See [SPRINT_3_DESIGN.md](SPRINT_3_DESIGN.md) for decisions and remaining deliverables.

## First deliverable

- Energy page with accessible-site/year selection, active-meter monthly entry, historical readings and calendar-year coverage.
- Decimal kWh/MWh normalization with stored factor/version, source quantity/unit/fuel and audit provenance.
- Explicit net cost, currency, VAT and gross cost; null remains unknown and zero remains valid.
- Historical site-attribute snapshots, estimated-reading warnings, missing-driver warnings and mid-month-change warnings.
- Duplicate/overlap prevention for calendar-month records, including concurrent submissions. Tenant composite foreign keys and assigned-site read restrictions.
- Successful form reset, failure input retention and a working Advanced Analysis navigation link.

## Executed evidence — 18 September 2026

- Nine unit tests passed (including two new energy cases).
- Four energy PostgreSQL integration groups passed: 12-month dataset and normalized/cost totals; duplicate/tenant rejection; assigned-site reads and restricted writes; unsupported conversions, concurrent duplicates, missing drivers and archive retention.
- All five browser scenarios passed across final runs. The original run passed the three existing onboarding/form-recovery/Sprint 2 scenarios. The rerun passed the foundation lifecycle/navigation scenario and the new Energy entry/persistence scenario after correcting outdated placeholder and ambiguous alert assertions.
- Local migration `202609180002_energy_records` applied to `energiepad_v2` on port 55432 without replacing existing site data. Local Energy page loaded and visually reviewed; no test consumption was added to the user's workspace.

## Remaining acceptance gates

Reviewed tariff/catalog migration adapters, legacy occupancy/pattern/event preservation and consumption migration reconciliation remain open. Organisation catalogs and explicit reading associations are delivered below. The combined 12-month acceptance check is recorded below. Weather enrichment evidence is recorded below; calculation compatibility, production deployment and remote CI success are not claimed.
- Lint, formatting, TypeScript and the production Webpack build passed. Build used the separate `.next-e2e` output directory to preserve the running development preview.


## Conversion milestone verification

- Added immutable, meter-specific m3/litre/kg conversion versions with provenance and explicit validity months, tenant-safe access, overlap rejection and consumption linkage.
- Ten unit tests passed. Energy integration now includes sourced-factor precision, validity boundaries, concurrent overlap rejection, immutable database rows, stable historical results, permission checks and meter fuel/unit changes.
- No real fuel factors or weather data were seeded. The existing 2020 synthetic electricity dataset remains unchanged.
- Expanded Energy browser scenario passed (42.3 seconds), including creation of a synthetic gas factor, physical-unit entry and displayed provenance. TypeScript, lint and formatting passed. Migration `202609180003_energy_conversions` applied locally without changing existing consumption values.

## Consumption import milestone — 19 September 2026

- Delivered XLSX upload, sheet/column/default mapping, explicit meter/unit/cost confirmation, normalized preview, CSV errors, atomic commit and recent-batch reopening on Energy.
- Added tenant-owned EnergyImportBatch and consumption provenance with migration `202609190001_energy_imports`, applied to the local V2 database.
- Twelve unit tests passed. Existing energy integration checks passed after sharing reading preparation with imports.
- New import integration checks passed: complete 12-month normalized/tax totals; credential stripping; upload and concurrent-commit idempotency; tenant boundaries; duplicate/unit rejection; no partial writes on stale existing periods; changed historical-context detection and revalidation; revoked write access.
- TypeScript, lint and formatting passed. The 2020 demo dataset was not changed.

The remaining sprint work includes tariff/end-use mappings and full legacy mapping. The combined import-plus-weather check is recorded below; full legacy parity remains open.
- Expanded Energy browser workflow passed, including unit-error repair, CSV download, 12-month workbook commit and complete-year coverage. Production Webpack build passed using `.next-e2e` to keep the local preview separate.


## Monthly drivers milestone — 19 September 2026

- Added independent site/month observations for average population and total operating hours, sources/authors/import provenance, zero-preserving validation and separate annual driver completeness.
- Added planned weekly operating schedules with inclusive date UI, bounded hours and concurrent overlap protection; no automatic observed values.
- Added driver workbook preview, actionable row errors, atomic commit and recent imports. Credential removal, permission rechecks and idempotency use the existing import/security conventions.
- Fifteen unit tests passed. Four new PostgreSQL integration groups passed: calendar-hour/leap-year limits, zero/missing distinction, tenant boundaries, concurrent duplicate/overlap handling, adjacent schedule dates, 24 observations across 12 months, credential stripping, repeated upload/concurrent commit, stale batch rollback, assigned-site reads, revoked permissions and archive protection.
- TypeScript and lint passed. Tests use isolated temporary databases; no observations or schedules were seeded into the user's workspace.
- Expanded Sprint 3 browser scenario passed, including zero observation entry, form reset, schedule overlap errors with retained input, confirmed 12-month driver workbook commit and reload persistence. Mobile screenshot reviewed; tables scroll within their panels.
- Production Webpack build passed. Migration `202609190002_monthly_drivers` applied to the existing local database; local services and the app preview are running. Existing consumption values and historical attributes were not rewritten.


## Weather enrichment milestone — 19 September 2026

- Added immutable, sourced site weather settings, Open-Meteo ERA5 adapter, strict complete-day validation, monthly mean-temperature/HDD/CDD/daylight aggregates, provenance and version selection on Energy.
- Nineteen unit tests passed, including settings/year bounds, leap years, degree-day calculations, true zero, missing/null/duplicate/reordered days, units, timezone/grid validation, bounded responses and API-key redaction/configuration.
- Four weather PostgreSQL integration groups passed: full 366-day/12-month results alongside existing consumption, concurrent/idempotent commits, tenant boundaries, configuration version history, immutable results, provider/missing-data failures with no partial saves, successful explicit retry, assigned-site access, permission revocation and site archive during provider I/O.
- Live adapter smoke check against public London coordinates returned 366 daily records and 12 monthly aggregates for 2020. Results were not persisted and no user site coordinates were sent.
- Migration `202609190003_weather_enrichment` applied to the existing local database. No weather configuration or weather records were created for user sites; existing consumption and driver values remain unchanged.
- The durable-job/retry milestone is recorded below. Commercial operation requires a configured Open-Meteo key entitled to the historical API.

- Expanded Sprint 3 browser workflow passed: real settings creation/version persistence plus synthetic browser responses for visible provider failure, explicit retry, monthly results and prior-version selection. PostgreSQL/provider behavior is independently covered by integration tests; the browser suite makes no external weather requests. Mobile weather panel reviewed.
- TypeScript, lint and formatting passed.
- Production Webpack build passed with `.next-e2e`; local preview remains on port 3100.


## Durable job milestone — 21 September 2026

- Added PostgreSQL-backed weather jobs, independent worker, bounded retries, interrupted-work recovery, scoped manual retry, safe failure reasons and live progress on Energy.
- Twenty unit tests passed. Five job integration groups passed: enqueue/concurrent deduplication with one provider execution, retry backoff/exhaustion/manual recovery, fresh-worker recovery, stale-worker fencing, non-retryable provider errors and permission/archive checks. Existing four weather integration groups also passed after adding atomic job completion.
- Expanded Sprint 3 browser scenario passed (1.4 minutes): real API enqueue/idempotency, synthetic browser job state fixtures across reload, waiting/failure/manual retry, automatic polling to completion and prior-version selection. Tests do not run external weather calls.
- TypeScript, lint and production Webpack build passed. Existing locally stored weather, observations and consumption are preserved.
- Migration `202609210001_weather_jobs` applied locally. The existing database was recovered from stale startup/socket locks without a reset. The app and weather worker are running locally; no test jobs or weather observations were added to user sites.
- Final job integration rerun passed against the stricter lease-state database constraint; formatting passed. Worker runtime dependencies were promoted without changing their locked versions.

## Audited energy corrections — 21 September 2026

- Added immutable reading/conversion revision chains, required correction reasons, author/time/audit provenance, scoped history and Owner/Admin correction forms. Current coverage excludes historical revisions; old conversion and attribute snapshots remain reproducible.
- Twenty-one unit tests passed. Four correction integration groups passed, covering zero/tax calculations, snapshot stability, tenant and role boundaries, stale/concurrent corrections, database immutability, conversion overlap and explicit renormalization, stale import previews, preserved import provenance, idempotent recommits and archived meter/site behavior. Existing five energy and four consumption-import integration groups passed.
- Expanded Sprint 3 browser scenario passed (1.6 minutes), including factor replacement without automatic historical recalculation, explicit reading renormalization, old/new history, cancellation and reload persistence. History screenshot reviewed.
- TypeScript, lint and production Webpack build passed. Migration `202609210002_energy_corrections` applied to the existing local database; the development server was restarted. Existing values were preserved.
- The consolidated sprint acceptance audit remains open; this milestone does not claim full Sprint 3 completion.

## Driver and schedule correction milestone — 21 September 2026

- Added immutable observation/schedule revisions with required reasons, author/time, audit events and tenant-scoped history. Current coverage excludes old observations; schedule overlap checks exclude superseded ranges.
- All 21 unit tests and lint passed. Six driver integration groups passed, including correction identity restrictions, zero, import provenance/recommit behavior, concurrent/stale edits, released schedule dates, overlap rejection, immutable rows, assigned-site history, denied writes and archived-site protection.
- Full Sprint 3 acceptance remains open for consolidated validation and legacy/tariff/end-use mapping.

- Expanded Sprint 3 browser workflow passed (1.3 minutes), including observation and schedule corrections, unchanged coverage, historical values, cancellation and reload persistence. Correction history screenshot reviewed. TypeScript and formatting passed.
- Migration `202609210003_driver_corrections` applied locally without rewriting existing values. Local preview restarted with the regenerated database client.
- Production Webpack build passed. Changes remain uncommitted.

## Consolidated acceptance audit — 21 September 2026

- Reran all eight existing integration scripts successfully: foundation, sites, consumption, consumption imports, drivers/schedules, weather, durable jobs and energy corrections.
- Added and passed `scripts/sprint3-acceptance.ts`, now included in `npm run test:integration`. One isolated site receives twelve imported consumption months and 24 driver observations, then a queued weather request fails safely and recovers with a fresh worker. The check verifies visible retry/success states, no weather result during failure, 366 daily / twelve monthly results, consumption/tax totals, preserved readings and idempotent recommits.
- This closes the combined deterministic import/enrichment verification gap. It uses synthetic provider responses and no user-site data or live provider calls.
- [SPRINT_3_AUDIT.md](SPRINT_3_AUDIT.md) records the remaining tariff/end-use, occupancy/pattern/event and consumption migration gaps. Sprint 3 remains in progress; no automatic deferral or parity claim is made.
- TypeScript, lint, all 21 unit tests and formatting passed. This step changes tests/documentation only; the application build and browser checks from the preceding milestone were not repeated.

## Site end uses and tariff versions — 21 September 2026

- Added site-owned end-use identities with namespaced legacy associations, explicit dated tariffs, weekday/time bands, sources and immutable correction history. Current tariff overlap checks preserve historical pricing and recorded consumption costs.
- All 24 unit tests passed; TypeScript and lint passed. Three tariff integration groups passed: duplicate legacy identity and tenant/site constraints, concurrent interval overlap rejection, revisions and released dates, unchanged consumption, database immutability, assigned-site history, denied writes and archive protection.
- Shared catalog management, reading-to-use links and reviewed migration adapters remain open; this milestone does not close full Sprint 3 legacy parity.
- Expanded Sprint 3 browser workflow passed (1.9 minutes), including site end-use registration/form reset, explicit tariff creation, uppercase currency, immutable rate correction, cancellation and reload/history persistence. Tariff history screenshot reviewed. Formatting passed.
- Migration `202609210004_tariffs` applied to the existing local database and the preview restarted. No user tariffs, end uses or consumption values were seeded or changed.
- Production Webpack build passed using the separate `.next-e2e` directory. Changes remain uncommitted.

## Shared catalogs and reading associations — 21 September 2026

- Added organisation-owned fuel/end-use catalog versions with label/colour/source history, fixed namespaced identities and retirement; site registrations pin current active versions. Existing uses keep their old versions.
- Added optional single reading-to-site-use references and snapshots without replacing original labels. Manual entry, audited corrections and workbook code mapping support explicit linking. Existing records are not automatically matched.
- Three new integration groups passed for tenant/shared-site boundaries, immutable identities, label revisions and pinned snapshots, explicit unlinking, retired/stale version rejection, concurrent corrections, imported associations/idempotency, assigned-site reads and write/archive restrictions. Existing four consumption-import and four energy-correction groups passed.
- All 24 unit tests, lint and TypeScript passed. Migration 202609210005_energy_catalog applied locally; no catalog/use/reading data was seeded.
- Expanded Sprint 3 browser workflow passed (1.7 minutes) after recovering a generated dev-test cache/connection failure. It verifies catalog registration/revision, pinned site registration, explicit historical reading links, unchanged coverage, reload persistence and old catalog labels in reading history. Screenshot reviewed; formatting passed.
- Production Webpack build passed. Local preview restored after isolated verification; changes remain uncommitted.

## Legacy tariff/catalog dry run — 21 September 2026

- Added an executable bounded JSON adapter and tenant-aware read-only target preflight. Reports include sanitized original fields, logical destination dependencies, explicit decimal unit/tax conversions, per-table reconciliation and blockers.
- All 30 unit tests passed, including six adapter tests for successful reconciliation, unknown-credential removal, missing decisions/orphans/unmapped bands, duplicate IDs/codes/aliases, unsafe IDs, overlaps/precision and zero preservation. Lint and TypeScript passed.
- This is the preview milestone only. Atomic apply/reuse and reconciliation against a reviewed real export remain open. No application schema or UI changes are introduced by this milestone.
- Two isolated PostgreSQL/CLI integration groups passed: read-only snapshot, role and foreign-site checks, zero domain/audit writes, ready/blocked/error exits, 0600 report permissions, overwrite/size protection, existing-destination conflicts and revoked-role rejection. No real source export was migrated.

### Atomic tariff migration apply — 2026-09-21

Implemented the explicit operator apply command, matching reviewed-input hash/organisation, current authorization and destination checks under the organisation lock. Catalogs, site uses, tariffs, audits and an immutable source-to-target receipt commit together. Identical retries reuse the batch; independently created matching destinations remain conflicts.

Verification: 30 unit tests passed; ESLint and TypeScript passed. Isolated PostgreSQL checks passed for changed review/source, archived destination, forced late-insert rollback (including audits), concurrent apply/retry, preserved source-row links, decimal conversions, immutable receipt update/delete/truncate guards and revoked-role rejection. Apply CLI retry recovered the batch ID without new writes and denied a downgraded operator. Existing read-only preview integration/CLI checks also passed. No production export was imported; real-source reconciliation remains open. Browser tests were not rerun for this server/CLI-only increment.

## Occupancy history and import — 21 September 2026

- Delivered audit point 1: separate regular/irregular nullable whole counts, explicit inclusive periods, required registered site end use, source and namespaced legacy identity; entry/read/correction/history UI and tenant-scoped APIs.
- Immutable database revisions retain period/use/legacy identity/import batch, author/time and required correction reason. No monthly driver or account is created from counts.
- Workbook preview exposes all rows and source/parsed/error counts; imports revalidate destinations and authorization and commit observations/audits atomically. Repeat uploads and concurrent commits reuse batches. Recent imports can be reopened.
- All 33 unit tests, TypeScript, ESLint and new-file formatting passed. Isolated PostgreSQL integration passed for zero/unknown, period overlap, invalid end-use/site, denied writes, stale corrections, immutable history, 24-row reconciliation, concurrent/repeated commit, imported corrections, stale-batch rollback, assigned-site reads and archived-site writes.
- Expanded Sprint 3 browser workflow passed (2.7 minutes; 3.2 minutes including setup): occupancy entry/form reset, correction and original-value history, cancel, XLSX preview/confirmation/commit. Panel screenshot reviewed. An earlier run hit generated Next.js manifest/cache errors; clearing only the isolated test build cache resolved them.
- Migration 202609210007_occupancy applied to the local database after restarting the stopped local PostgreSQL service. No user occupancy records were seeded or imported. Operating-pattern/event gaps and real-source migration reconciliation remain open.
- Production Webpack build passed after the browser checks. Changes remain uncommitted.

## End-use operating patterns — 21 September 2026

- Delivered audit point 2: explicit end-use validity periods, nullable annual active-day counts, decimal temperature/setpoint values with explicit unit/context (including unresolved evidence), source and namespaced legacy identity.
- Added entry/read/correction/history and bounded XLSX preview/atomic commit. Corrections preserve prior dates and values; current periods cannot overlap for an end use. Incomplete evidence and annual-day/validity discrepancies are visible warnings, without deriving observations or changing weather settings.
- All 37 unit tests and TypeScript passed. Isolated PostgreSQL integration passed for site/end-use and write authorization, zero/unknown, overlap rejection, immutable revisions, changed-date lineage, signed decimal temperatures, 24-row reconciliation, concurrent/idempotent import, correction preservation, stale-import rollback, assigned-site reads and archive protection. No driver observations, weekly schedules or weather configurations were generated.
- Focused browser test passed (42.6 seconds; 1.4 minutes including setup): entry/reset, unresolved-unit warning, reviewed unit/context and date correction, original history, cancellation, preview/confirmation/import and zero-value persistence after reload. Screenshot reviewed. The server logged a stream-closed message during navigation, but all assertions completed successfully.
- Migration 202609210008_patterns applied locally. No user pattern records were seeded/imported. Audit points 3–6 and real-export reconciliation remain open.
- ESLint, new-file formatting and production Webpack build passed. Local preview restored after verification; changes remain uncommitted.

## Operational events and log imports — 21 September 2026

- Delivered audit point 3: stable site event codes, registered end-use/date links, operation, comments, source and namespaced legacy identities. Events may overlap; codes and source identities prevent duplicate imports.
- Added entry/read/correction/history and XLSX preview/atomic commit with all-row reconciliation and recent-batch recovery. Corrections preserve earlier dates/text/author/time and batch lineage. Event evidence does not imply verified savings or alter energy readings.
- All 40 unit tests, TypeScript and ESLint passed. Isolated PostgreSQL integration passed for scoped end uses, denied writes, overlapping events, duplicate codes, immutable revisions, changed-date history, 24-row reconciliation, concurrent/repeated commits, preserved imported corrections, stale-batch rollback, assigned-site reads and archived-site protection.
- Corrected the preceding pattern test's TRUNCATE assertion to reference OperatingPattern instead of a nonexistent table; reran the pattern integration suite successfully.
- Browser workflow passed initially (1.1 minutes; 1.5 minutes including setup): entry/reset, markup-like comments rendered as text, date/comment correction with original history, cancel, overlapping-event workbook preview/confirmation/commit and persistence after reload. Screenshot review identified a missing comments-field border, which was corrected and added to the browser assertions.
- Migration 202609210009_events applied locally. No user events were seeded/imported. Audit points 4–6 and real-export reconciliation remain open; opportunity links follow Sprint 6.
- Browser workflow passed again after the comments-field styling fix (1.1 minutes; 1.5 minutes including setup), including an explicit border-style assertion. Updated screenshot reviewed.
- Formatting and production Webpack build passed. Local preview restored after verification. Changes remain uncommitted.

## Consumption and meter migration provenance — 21 September 2026

- Delivered audit point 4's executable reviewed BusinessFuelsSize/UtilityConsumptions mapping. Source meter strings/tokens resolve explicitly to registered scoped meters; a source reading maps to exactly one meter/month. Ambiguous allocation, duplicate identities/periods, unavailable targets and conflicting drivers block apply.
- Added immutable migration batches/source-to-target rows and separate reading sourceProvenance. Original timestamps, VAT/cost/factor/unit and population/hours remain alongside explicit decisions, selected conversion/driver links and calculated deltas. Corrections preserve evidence unchanged, enforced in PostgreSQL. Reading history exposes original evidence separately from current amounts.
- Preview is read-only; reviewed source and target signatures are rechecked under the organisation lock. Domain rows, drivers, audits and receipts commit atomically, and identical concurrent/repeated applies reuse the batch. Identical prior meter mappings can be reused in subsequent batches after canonical JSON comparison. Grouped reconciliation totals retain unit/currency/basis separation and missing-value counters.
- All 43 unit tests passed, including schema sanitization/timestamp/semantics checks and server-rendered evidence tests for zero, unknown timestamps, discrepancy display and escaped source text. TypeScript passed. The final migration integration run passed source/factor/tax/driver/scope blockers, stale destination signatures, forced late rollback, concurrent retry, source preservation across corrections, immutable ledgers, meter-map reuse, equal-driver reuse/conflicts, CLI permission/overwrite checks and revoked-write denial.
- Existing reading-correction, consumption-workbook and tariff-preview integration suites passed. The small evidence display was verified by rendering tests; browser E2E was not rerun for this primarily server/CLI increment.
- Migration 202609210010_legacy_energy applied locally. No legacy records were imported into user sites. Destination meters and sourced conversion versions must already be registered, and real-export reconciliation/cutover remains open. See LEGACY_ENERGY_MIGRATION.md for commands and review format.
- Final formatting, ESLint and production Webpack build passed. Local preview restored; changes remain uncommitted.

## Audit point 6 — named worksheets and reusable mapping templates (22 September 2026)

Delivered consumption mapping save/load by worksheet/header names and driver/pattern named-sheet selection with portable version 1 JSON mappings. Selected/excluded worksheets are explicit in driver/pattern previews and stored results. Defaults never replace blank mapped cells; source values still pass the normal domain validators. FP15 now explicitly assigns emissions/factor and target/monitoring workbook imports to Sprint 5 with their destination models and acceptance requirements; these remain unimplemented retained obligations.

Executed verification:

- All 47 unit tests across 15 files passed, including five-sheet selection, reordered consumption columns, wrong kind/version, unknown fields, absent/ambiguous headers, template size, zero values, blank preservation and mapped setpoints.
- Driver, pattern and consumption import integration scripts passed using disposable PostgreSQL databases. New assertions cover named-header mappings, excluded worksheets, persisted selection evidence, one-row commits and identical retry after unrelated worksheet edits. Existing scope, immutable correction history, stale/conflict rollback and concurrent retry cases also passed.
- Two Chromium workflows passed (3.2 minutes): monthly energy entry/import with mapping download/reload and operating patterns/corrections with downloaded template reuse against a five-sheet workbook, excluded-sheet preview and commit persistence.
- ESLint, TypeScript and `git diff --check` passed. No production build was rerun for this milestone.

No real source workbook was imported and no emissions/target import implementation or all-sheet atomic transaction is claimed. Real-export reconciliation remains open separately.
