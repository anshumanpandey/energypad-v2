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

Tariff/end-use destinations, legacy occupancy/pattern/event preservation and consumption migration reconciliation remain open. The combined 12-month acceptance check is recorded below. Weather enrichment evidence is recorded below; calculation compatibility, production deployment and remote CI success are not claimed.
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
