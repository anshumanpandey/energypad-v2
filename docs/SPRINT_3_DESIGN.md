# Sprint 3 — energy and weather

Status: in progress. The first deliverable is monthly meter consumption. This is not full Sprint 3 acceptance.

## Implemented first deliverable

Energy now supports selecting an accessible site/year, entering calendar-month readings for active kWh/MWh meters, and viewing source/normalized quantities, net/gross cost and quality warnings. The server retains source units, meter fuel, conversion factor/version, author, creation time, optional end-use label and external legacy reference. Values are decimal; zero is valid and missing values remain null. Currency is normalized to uppercase. End use describes the whole meter reading; it does not allocate or duplicate energy across categories.

Periods are half-open calendar months. One reading per meter/month is enforced in PostgreSQL and under the organisation write lock; no implicit duplicate overwrite. Arbitrary billing periods and correction lineage are subsequent work. Energy-unit normalization uses exact dimensional factors kWh=1 and MWh=1000, version energy-si-v1. Volume/mass meters require an explicitly entered sourced conversion covering the full month; see the conversion milestone below.

Costs are explicitly net; supplied VAT is a percentage. Tax is computed from net cost, rounded to 3 decimal places, and added to net for gross. If VAT is absent, gross stays unknown. Currency is required with net cost. No cross-currency totals or financial reporting are produced.

Historical population, floor area and weekly operating hours are snapshotted from the latest entry effective at month start. Missing attributes and changes inside the month are flagged. Weekly hours are not silently converted to monthly operating hours. Future attribute edits cannot change these stored snapshots. Complete-year coverage displays each missing month, including future months, per active meter. Archived-meter readings remain visible.

Owner/Admin can write. Other roles read under existing site scope; Site Managers only see assigned sites. Composite foreign keys bind meter, site and organisation. Audit events are written in the same transaction as consumption.

## Next deliverables before sprint acceptance

1. Tariff/end-use mappings and monthly observed drivers; extend the delivered meter-specific conversion versions to approved shared catalogs if needed. Preserve all retained legacy energy fields with explicit tax/time-basis mapping.
2. Correction lineage and non-monthly overlap policies. Monthly workbook mapping/preview/atomic commit is delivered in the consumption import milestone below.
3. Weather provider adapter, explicit site coordinates and heating/cooling base temperatures, complete-day validation and methodology versioning. Persist provider/provenance rather than inventing missing observations. Provider selection was requested; no external weather requests or site-location transmissions have been implemented.
4. Durable enrichment job states, bounded retries and visible recovery, with tenant checks at execution and result access.
5. Validate import and weather enrichment across at least 12 months, provider-failure recovery, legacy energy mapping and UI/browser accessibility. Do not mark the sprint complete based on manual consumption entry alone.

No approved conversions for m3/litre/kg, implicit site coordinates, heating/cooling bases, or legacy VAT/time units are assumed. Calculation compatibility and emission factors remain later sprints.

## Weather candidate reviewed

[Open-Meteo historical API documentation](https://open-meteo.com/en/docs/historical-weather-api) was reviewed on 18 September 2026. ERA5 provides global reanalysis; daily temperature and daylight variables are available. Reanalysis is modeled historical data, not a direct station measurement. A future adapter must pin its dataset, preserve returned coordinates/provenance and respect commercial-use licensing, coverage and delayed data availability. No provider account or paid plan has been created.


## Conversion milestone

Meter-specific sourced conversion versions now support m3, litre and kg. Owner/Admin supplies kWh per source unit (positive, up to six decimal places, maximum 100000), first month, last month inclusive, and a source/reference. The service snapshots current meter fuel/unit and rejects overlapping periods under the organisation lock. Versions are immutable in PostgreSQL and retain author/time provenance. There are no guessed fuel factors or automatic external lookups.

Consumption selects only a version with matching tenant/site/meter/fuel/unit covering the whole month. Missing or expired factors fail explicitly. The normalized value rounds to three decimal places; the original quantity and six-decimal factor are retained. Each reading references its immutable version and exposes conversion provenance in the Energy table. New versions do not recalculate old readings. Fixed kWh/MWh dimensional conversions cannot be overridden.

This is a bounded meter-specific catalog, not an approved global factor library. Incorrect saved versions currently require a future audited correction workflow; the UI warns that versions cannot be edited and does not offer deletion. Tariff automation, allocation taxonomies and monthly observed drivers remain outstanding.

## Consumption import milestone

The Energy page now includes an XLSX importer for one explicitly selected active meter per batch. It reuses the bounded workbook parser and credential-column discard policy. Files are transient; only sanitized cells are staged. Uploads are limited to 20 attempts per organisation/hour. Workbooks use plain values (not formulas), and the selected sheet must contain 1–120 monthly rows. Months must be text in YYYY-MM format; ambiguous dates are rejected. Source units must exactly match the meter. Actual/estimated status must be supplied in a mapped column or explicit default.

Users select the sheet, map columns or provide defaults, confirm the meter/unit/net-cost basis, and validate. The preview includes normalized energy, costs and quality warnings; row errors are downloadable as CSV. Invalid rows, duplicate months, existing periods, unsupported conversion coverage and inactive meters prevent commit. Changing a mapping hides its stale preview. Reopened batches must be validated again in the UI. The recent-import list allows recovery after navigating away.

EnergyImportBatch is separate from the site importer. Fingerprints deduplicate sanitized content per meter, including across organisations through globally unique tenant-owned meters. The batch has a composite tenant FK and imported readings reference its id. No workbook can switch meter after upload. Uploading the same workbook for a different meter intentionally creates a different batch.

Preview and commit reuse the same reading preparation code as manual entry. Commit locks the organisation, checks the actor's current permissions, revalidates every row and compares a signature of prepared domain inputs/results. A changed meter, conversion context, attribute snapshot or newly occupied month requires a new preview. All readings, per-reading audit events and batch completion are written in one transaction. Simultaneous/repeated commits return the completed batch without duplicate readings or commit audit. Failures leave no partial readings.

This importer creates new monthly readings only. Corrections, arbitrary billing periods, multi-meter sheets and direct migration of ambiguous legacy tax/working-hour fields remain separate work.
