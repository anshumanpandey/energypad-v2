# Sprint 3 consolidated audit — 21 September 2026

Status: **in progress; not ready for closure**. This audit compares the current V2 schema/services with the Sprint 3 gate in V2_IMPLEMENTATION_PLAN.md and retained features in FEATURE_PARITY.md. Earlier milestone checks demonstrate implemented behavior; they do not establish full legacy parity.

## Acceptance coverage

| Gate | Current evidence | Status |
| --- | --- | --- |
| Twelve monthly consumption records imported for one site | Consumption import integration: normalized/tax totals, atomic writes, idempotent retry | Implemented |
| Independent monthly population and operating hours | Driver integration: 24 observations, zero/missing semantics, sources, imports and revision history | Implemented |
| Twelve months enriched through durable jobs | Combined acceptance script imports consumption/drivers, simulates a provider outage, checks visible retry state with no fabricated result, resumes through a fresh worker and verifies 366 stored days / 12 monthly results | Implemented; test results recorded in SPRINT_3_ACCEPTANCE.md |
| Missing/duplicate/overlapping periods | Current calendar-month coverage, observation coverage, duplicate rejection and current schedule/conversion overlap checks | Implemented for calendar-month consumption; arbitrary bill periods are rejected |
| Corrections preserve evidence | Immutable reading, conversion, observation and schedule revision chains; original sources/import links retained | Implemented |
| Every retained legacy energy field has an executable mapping | Discovery destinations exist, but several have no V2 model/import destination or need explicit source semantics | **Open**, as detailed below |

The combined test uses synthetic provider responses through the real adapter and durable worker, in a disposable database. It sends no live weather request and writes no test records to the local user workspace. Prior live provider smoke checks are separate evidence; they are not substituted for deterministic failure testing.

## Remaining work, in implementation order

1. **Occupancy history and import (FP08, FP16) — implemented.** Separate nullable regular/irregular counts now retain explicit inclusive periods, registered site end uses, source references, namespaced legacy identities and immutable correction history. Energy provides entry/history/correction and bounded XLSX preview/atomic commit with full row reconciliation and retry safety. Reviewed legacy site/use/date mapping is explicit; counts do not become monthly population averages. Real-source reconciliation remains part of the migration evidence gate. See the occupancy milestone in SPRINT_3_DESIGN.md and SPRINT_3_ACCEPTANCE.md.
2. **End-use operating patterns and setpoints (FP17) — implemented.** OperatingPattern now retains end-use-scoped inclusive validity dates, nullable annual active days, decimal temperature, explicit C/F/UNKNOWN units and HEATING/COOLING/OTHER/UNKNOWN context, source and namespaced legacy identity. Entry, read, correction/history and XLSX preview/atomic commit are available. Missing evidence and annual-day/interval discrepancies remain visible warnings; patterns never overwrite weather bases or observed drivers. Real-export semantics/reconciliation remain an explicit migration gate.
3. **Operational events and log imports (FP16, FP18) — implemented.** OperationalEvent now retains site/end-use links, inclusive dates, operation, comments, source and namespaced legacy identity. Stable site event codes distinguish overlapping events. Entry/read/correction/history and XLSX preview/atomic commit preserve evidence and reconcile every row; imported corrections retain batch lineage. Events are evidence only; opportunity links and verified-savings workflows remain Sprint 6. Real-source mapping/reconciliation remains explicit.
4. **Consumption and meter source provenance/migration — implemented.** A bounded reviewed BusinessFuelsSize/UtilityConsumptions adapter maps every meter-list token to a registered scoped meter and each consumption row to exactly one meter/month. It retains original timestamps, supplied VAT/cost/factor/unit and population/hours evidence; explicit tax/conversion/driver decisions drive normal V2 validation. Per-row deltas and grouped totals reconcile source to calculated values. Conflicting driver values and ambiguous allocations block apply. Atomic writes create immutable source-to-target receipts, and reading corrections preserve original evidence. Real-export reconciliation remains open. See LEGACY_ENERGY_MIGRATION.md.
5. **Tariff/catalog source reconciliation.** The six-table preview and atomic apply are implemented, with an immutable source-to-target receipt and identical-batch retry. Remaining evidence requires a reviewed real export and explicit tax/rate/day decisions; no real source has been reconciled. Independently existing destination records and source aliases remain blockers, not supported reuse cases. Determine whether the actual export needs a reviewed adoption/alias path before extending it. Production cutover remains Sprint 8.
6. **Workbook parity scope (FP15) — Sprint 3 portions implemented; allocation explicit.** Consumption mappings can be saved/loaded as versioned JSON files resolved by worksheet/header names. Drivers and patterns/setpoints now accept explicitly selected sheets from multi-sheet XLSX files, with reusable v1 source-header/default mappings. Previews retain and display selected/excluded sheets; each batch remains atomic and scoped, with normal duplicate/stale checks and retry protection. FP15 now explicitly retains emissions/factor and target/monitoring imports in Sprint 5 alongside their destination models, with acceptance requirements recorded in the implementation plan. No emissions/target implementation or full production workbook reconciliation is claimed. See WORKBOOK_IMPORT_TEMPLATES.md.

Full production migration execution remains Sprint 8, but Sprint 3 requires explicit, supported destinations for retained energy fields. Discovery tables alone do not satisfy that gate. No feature is silently retired or deferred by this audit.

### Point 5 source availability check

The local candidate `backup.sql` was inspected read-only: none of the six required tariff/catalog table names occurs in it. The candidate `app_energiepad_com` directory contains certificate files, not a source-table export; certificate contents were not read. Repository migrations and synthetic fixtures supply schema/test evidence only. A usable real export has not been identified, and no source records were applied. Point 5 remains open pending the export location and reviewed mapping/semantics. The closure evidence checklist is in [LEGACY_TARIFF_DRY_RUN.md](LEGACY_TARIFF_DRY_RUN.md#evidence-needed-to-close-audit-point-5).

## Representative evidence

- V2 persistence: apps/web/prisma/schema.prisma (ConsumptionRecord, UnitConversionVersion, DriverObservation, OperatingSchedule, WeatherConfiguration, WeatherYear, WeatherJob).
- V2 input boundaries: apps/web/src/domain/energy.ts and drivers.ts; src/server/energy-import.ts and drivers.ts.
- Legacy field-level sources: docs/MIGRATION_MAP.md, especially BusinessBrands, BusinessFuelsPricing, BusinessTenant, BusinessPatterns, UtilityConsumptions and site/fuel/use associations.
- Legacy retained dispositions: docs/FEATURE_PARITY.md FP08–FP11 and FP16–FP18.
- Reproducible combined check: apps/web/scripts/sprint3-acceptance.ts, included in npm run test:integration.
- Existing regression evidence and execution results: docs/SPRINT_3_ACCEPTANCE.md.

Sprint 4 remains subject to its separate approved-fixture gate. This audit does not approve calculation compatibility or production deployment.

## Latest inspection

Rechecked after the atomic tariff apply milestone against the current Prisma models, driver input/import contracts, consumption import mapping and legacy adapter directory. The numbered items retain stable audit references and separate implementation gaps from source-dependent evidence. Points 1–4 have implemented destinations/workflows; point 5 and real-export reconciliation remain open. Point 6 has since been addressed by the named-sheet/template milestone and explicit FP15 sprint allocation. Existing acceptance results were reviewed; tests were not rerun for this documentation-only audit. Sprint 4 workbook/tolerance approval is a separate gate, not a missing Sprint 3 feature.
