# Sprint 3 progress and verification

Status: **in progress**. Monthly manual consumption is implemented; full sprint acceptance is not yet met. See [SPRINT_3_DESIGN.md](SPRINT_3_DESIGN.md) for decisions and remaining deliverables.

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

Shared approved conversion catalogs, monthly observed drivers and full legacy mapping, correction lineage, weather provider integration, enrichment jobs/retries and 12-month import-plus-enrichment validation remain to be implemented. No weather coverage, calculation compatibility, production deployment or remote CI success is claimed.
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

The remaining sprint work includes monthly observed drivers, tariff/end-use mappings, correction lineage, full legacy mapping, weather integration and durable enrichment jobs. The full Sprint 3 import-plus-weather acceptance gate remains open.
- Expanded Energy browser workflow passed, including unit-error repair, CSV download, 12-month workbook commit and complete-year coverage. Production Webpack build passed using `.next-e2e` to keep the local preview separate.
