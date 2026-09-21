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

1. **Tariff and end-use records and mappings (FP09–FP11).** V2 has a meter fuel string and a free-text reading end-use label, not stable fuel/use catalogs or site-to-end-use associations. It has recorded net/VAT/gross cost, not BusinessBrands time bands/rates/days or BusinessFuelsPricing versions. Add scoped, versioned destinations and source identity maps before claiming parity. Explicitly resolve rate unit, currency, timezone, tax inclusion and end-use quantity ownership; never allocate a whole-meter quantity repeatedly across use labels.
2. **Legacy occupancy, operating patterns and operational events (FP08, FP16–FP18).** Average site population does not preserve separate regular/irregular occupancy counts or their end-use association. Weekly schedules do not retain annual days, legacy temperature setpoints or per-end-use patterns. Weather heating/cooling bases are methodology settings, not a lossless replacement for those patterns. Event/log records and their import path are absent. Preserve these independently before deriving analytical observations.
3. **Consumption field provenance and migration reconciliation.** The workbook importer accepts explicit monthly quantities, source units, net cost and VAT percentage; it is not yet a lossless UtilityConsumptions migration. Source creation/update timestamps have no separate migration fields; supplied legacy vatCost is recalculated instead of independently retained/reconciled; legacy conversion factors need source/version mapping; population and workingHours require reviewed period/basis and conflict handling across meter rows. A production source export and agreed semantics are needed for final reconciliation, not for implementing the missing destinations.

Full production migration execution remains Sprint 8, but Sprint 3 requires explicit, supported destinations for retained energy fields. Discovery tables alone do not satisfy that gate. No feature is silently retired or deferred by this audit.

## Representative evidence

- V2 persistence: apps/web/prisma/schema.prisma (ConsumptionRecord, UnitConversionVersion, DriverObservation, OperatingSchedule, WeatherConfiguration, WeatherYear, WeatherJob).
- V2 input boundaries: apps/web/src/domain/energy.ts and drivers.ts; src/server/energy-import.ts and drivers.ts.
- Legacy field-level sources: docs/MIGRATION_MAP.md, especially BusinessBrands, BusinessFuelsPricing, BusinessTenant, BusinessPatterns, UtilityConsumptions and site/fuel/use associations.
- Legacy retained dispositions: docs/FEATURE_PARITY.md FP08–FP11 and FP16–FP18.
- Reproducible combined check: apps/web/scripts/sprint3-acceptance.ts, included in npm run test:integration.
- Existing regression evidence and execution results: docs/SPRINT_3_ACCEPTANCE.md.

Sprint 4 remains subject to its separate approved-fixture gate. This audit does not approve calculation compatibility or production deployment.
