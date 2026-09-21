# Sprint 3 — energy and weather

Status: in progress. The first deliverable is monthly meter consumption. This is not full Sprint 3 acceptance.

## Implemented first deliverable

Energy now supports selecting an accessible site/year, entering calendar-month readings for active kWh/MWh meters, and viewing source/normalized quantities, net/gross cost and quality warnings. The server retains source units, meter fuel, conversion factor/version, author, creation time, optional end-use label and external legacy reference. Values are decimal; zero is valid and missing values remain null. Currency is normalized to uppercase. End use describes the whole meter reading; it does not allocate or duplicate energy across categories.

Periods are half-open calendar months. One reading per meter/month is enforced in PostgreSQL and under the organisation write lock; no implicit duplicate overwrite. Audited reading corrections are delivered below. Arbitrary billing periods are rejected; no implicit proration is performed. Energy-unit normalization uses exact dimensional factors kWh=1 and MWh=1000, version energy-si-v1. Volume/mass meters require an explicitly entered sourced conversion covering the full month; see the conversion milestone below.

Costs are explicitly net; supplied VAT is a percentage. Tax is computed from net cost, rounded to 3 decimal places, and added to net for gross. If VAT is absent, gross stays unknown. Currency is required with net cost. No cross-currency totals or financial reporting are produced.

Historical population, floor area and weekly operating hours are snapshotted from the latest entry effective at month start. Missing attributes and changes inside the month are flagged. Weekly hours are not silently converted to monthly operating hours. Future attribute edits cannot change these stored snapshots. Complete-year coverage displays each missing month, including future months, per active meter. Archived-meter readings remain visible.

Owner/Admin can write. Other roles read under existing site scope; Site Managers only see assigned sites. Composite foreign keys bind meter, site and organisation. Audit events are written in the same transaction as consumption.

## Next deliverables before sprint acceptance

1. Tariff/end-use mappings; extend the delivered meter-specific conversion versions to approved shared catalogs if needed. Preserve all retained legacy energy fields with explicit tax/time-basis mapping.
2. Reading and conversion correction lineage is delivered below. Calendar-month-only validation rejects non-monthly periods; arbitrary billing-period support remains outside this milestone.
3. Weather enrichment and durable jobs are delivered below; finish the combined acceptance and legacy-mapping gates.
4. Durable job delivery and recovery are implemented below. Production deployment must run the worker process.
5. Validate import and weather enrichment across at least 12 months, provider-failure recovery, legacy energy mapping and UI/browser accessibility. Do not mark the sprint complete based on manual consumption entry alone.

No approved conversions for m3/litre/kg, implicit site coordinates, heating/cooling bases, or legacy VAT/time units are assumed. Calculation compatibility and emission factors remain later sprints.

## Weather candidate reviewed

[Open-Meteo historical API documentation](https://open-meteo.com/en/docs/historical-weather-api) was reviewed on 18 September 2026. ERA5 provides global reanalysis; daily temperature and daylight variables are available. Reanalysis is modeled historical data, not a direct station measurement. The delivered adapter pins ERA5 and preserves returned coordinates/provenance, with a seven-day publication allowance. No provider account or paid plan has been created.


## Conversion milestone

Meter-specific sourced conversion versions now support m3, litre and kg. Owner/Admin supplies kWh per source unit (positive, up to six decimal places, maximum 100000), first month, last month inclusive, and a source/reference. The service snapshots current meter fuel/unit and rejects overlapping periods under the organisation lock. Versions are immutable in PostgreSQL and retain author/time provenance. There are no guessed fuel factors or automatic external lookups.

Consumption selects only a version with matching tenant/site/meter/fuel/unit covering the whole month. Missing or expired factors fail explicitly. The normalized value rounds to three decimal places; the original quantity and six-decimal factor are retained. Each reading references its immutable version and exposes conversion provenance in the Energy table. New versions do not recalculate old readings. Fixed kWh/MWh dimensional conversions cannot be overridden.

This is a bounded meter-specific catalog, not an approved global factor library. Incorrect saved versions can be replaced through the audited correction workflow below; originals remain immutable. Tariff automation and allocation taxonomies remain outstanding.

## Consumption import milestone

The Energy page now includes an XLSX importer for one explicitly selected active meter per batch. It reuses the bounded workbook parser and credential-column discard policy. Files are transient; only sanitized cells are staged. Uploads are limited to 20 attempts per organisation/hour. Workbooks use plain values (not formulas), and the selected sheet must contain 1–120 monthly rows. Months must be text in YYYY-MM format; ambiguous dates are rejected. Source units must exactly match the meter. Actual/estimated status must be supplied in a mapped column or explicit default.

Users select the sheet, map columns or provide defaults, confirm the meter/unit/net-cost basis, and validate. The preview includes normalized energy, costs and quality warnings; row errors are downloadable as CSV. Invalid rows, duplicate months, existing periods, unsupported conversion coverage and inactive meters prevent commit. Changing a mapping hides its stale preview. Reopened batches must be validated again in the UI. The recent-import list allows recovery after navigating away.

EnergyImportBatch is separate from the site importer. Fingerprints deduplicate sanitized content per meter, including across organisations through globally unique tenant-owned meters. The batch has a composite tenant FK and imported readings reference its id. No workbook can switch meter after upload. Uploading the same workbook for a different meter intentionally creates a different batch.

Preview and commit reuse the same reading preparation code as manual entry. Commit locks the organisation, checks the actor's current permissions, revalidates every row and compares a signature of prepared domain inputs/results. A changed meter, conversion context, attribute snapshot or newly occupied month requires a new preview. All readings, per-reading audit events and batch completion are written in one transaction. Simultaneous/repeated commits return the completed batch without duplicate readings or commit audit. Failures leave no partial readings.

This importer creates new monthly readings only. Bulk corrections, arbitrary billing periods, multi-meter sheets and direct migration of ambiguous legacy tax/working-hour fields remain separate work.


## Monthly observed drivers and operating schedules — 19 September 2026

Energy now offers site-level monthly observations for `POPULATION` (average people over the calendar month) and `OPERATING_HOURS` (total elapsed site operating hours for the calendar month, not staff-hours). Each observation retains its source, author, time and optional import-batch reference. Zero is valid; missing stays absent. Decimal precision is three places; operating hours cannot exceed the actual calendar hours, including leap February. Separate population and hours rows let users record either without inventing the other.

These observations are independent of meter quantities and historical site-attribute snapshots. They are not multiplied per meter. Adding observations never rewrites consumption snapshots. Energy displays 12-month completeness separately for each observed driver, regardless of weekly site attributes. Existing attribute quality flags describe the original consumption snapshot; current observed-driver gaps have their own panel.

Operating schedules describe one site-wide planned weekly-hours value over an explicit date range. The UI accepts inclusive first/last dates; storage uses an exclusive end. Values are bounded to 0–168 hours/week. Adjacent ranges are allowed; overlapping ranges are rejected under the organisation lock. Schedules do not generate observed hours. Daily/time-of-day patterns and weather setpoints are not inferred.

Owner/Admin may add observations, schedules and imports; other roles may read within existing site scope. Site Managers require assignment. Writes recheck active site and membership inside the organisation transaction. Duplicate driver/month observations are rejected by service and database uniqueness. Audited driver and schedule revisions are delivered in the final correction milestone below.

The driver XLSX importer accepts one sheet with exactly `month`, `driver`, `value`, `source` headings (case-insensitive), 1–240 rows and the shared 2 MB workbook/parser limits. Driver codes are case-insensitive. Months are explicit YYYY-MM text. Credential columns are discarded before hashing/staging; only validated mapped values and generic row errors are stored. A preview shows all rows and errors; successful form submissions reset. Recent batches can be reopened. Invalid batches cannot commit. Commit revalidates values, permissions, site status and occupied months, and writes all observations, audits and batch completion atomically. Identical uploads and concurrent commits are idempotent. Changed/conflicting workbooks must be corrected and uploaded again; no existing observation is overwritten. Upload attempts are limited to 20 per organisation/hour.

This closes the monthly observation, bounded operating-schedule and driver-import gap. Legacy tax/time-basis mappings remain outstanding; ambiguous legacy workingHours cannot be automatically treated as monthly totals.


## Weather enrichment milestone — 19 September 2026

Energy now supports explicit, immutable weather configuration versions: latitude/longitude, IANA timezone, heating and cooling base temperatures in Celsius, source, author and creation time. No coordinates or base temperatures are guessed, including for the synthetic 2020 site. Saving new settings preserves older configurations and their results; the UI selects a version to view its coverage/results.

The provider interface is implemented by Open-Meteo's Historical Weather API, pinned to `models=era5`, Celsius, ISO calendar dates and nearest grid cell. Requests use the configured timezone. A fetch sends coordinates/timezone/dates only, without tenant, site, user or meter identity. Development without a key uses the public evaluation endpoint. Production requires server-only `OPEN_METEO_API_KEY` for the customer historical endpoint; no subscription is created by this implementation. An account must have Historical Weather API access. Reference: [historical API](https://open-meteo.com/en/docs/historical-weather-api), [pricing/licensing](https://open-meteo.com/en/pricing), reviewed 19 September 2026.

The bounded workflow fetches one completed calendar year from 1940 onwards, with at least seven full days after year end for publication. It checks returned coordinates against the ERA5 grid vicinity, timezone equivalence, Celsius/seconds units, every expected date exactly once in order, array lengths, finite values and plausible ranges. Null, missing, duplicate or out-of-order days reject the entire response. It does not substitute sample data or zero for missing observations. Reanalysis is explicitly identified as modeled historical weather, not station observations.

`daily-mean-degree-days-v1` computes daily HDD=max(0, heatingBase−dailyMean) and CDD=max(0, dailyMean−coolingBase). Calendar-month results retain mean daily temperature, summed HDD/CDD in Celsius-days, summed daylight seconds converted to hours, and day count. Aggregates round to three decimals; source daily values remain stored. WeatherYear retains the immutable settings reference, methodology, daily values, monthly aggregates, provider/dataset/endpoint, returned grid coordinates/elevation/timezone/offset, retrieval time, attribution, licence and SHA-256 input fingerprint. Open-Meteo/Copernicus attribution and the derived nature of aggregates appear in the UI.

Owner/Admin writes and assigned-site reads follow existing tenant policies. Organisation locks protect configuration versions and result commits. Network I/O occurs outside database transactions; permissions and active site are rechecked before storing results. Duplicate/concurrent requests persist one immutable result per settings/year/methodology and one completion audit. Existing results return without another provider call. Changes to weather settings never rewrite consumption or observed-driver records. PostgreSQL prevents updates/deletes/truncation of saved settings/results.

Fetches have a 25-second timeout, one-megabyte response cap, no redirects and a 20-attempt/org/hour limit. Provider errors are sanitized so API keys and upstream bodies are not logged or returned. Failures display a recoverable error; users can explicitly fetch again. This original synchronous service is now executed by the durable worker described below; the public endpoint only queues work.


## Durable weather jobs — 21 September 2026

The enrichment endpoint now persists a job and returns immediately. PostgreSQL owns QUEUED, RUNNING, RETRY_WAIT, SUCCEEDED and FAILED states, with one job per configuration/year/methodology. Identical requests reuse that job; saved results complete without another provider request. The Energy page polls while any job for the loaded site/year is active, displays attempts, next retry and safe failure reasons, and supports manual refresh/retry. Closing the page does not stop work.

Run `npm run weather:worker` from apps/web as a separate long-lived process alongside the web application, with the same database URL and server-only provider key. The worker polls every two seconds. `tsx` and `dotenv` are runtime dependencies, using the same pinned versions as before. Production must supervise/restart this process and allow graceful shutdown (finish the current request); this milestone does not provision a hosting supervisor.

Claims use organisation locking, a random lease token and a 90-second lease, longer than the provider's 25-second timeout. Multiple workers can share the queue safely. An expired lease can be reclaimed; each claim counts toward a maximum of three attempts per cycle, including crashed attempts. Result insertion, completion audit and job success commit atomically. A stale worker cannot write results or replace the status of a reclaimed job. No network request holds an organisation database lock.

Transient provider/network/incomplete-data failures retry after 30 then 120 seconds; provider throttling waits five minutes, and the organisation request limit waits one hour. Missing credentials, provider access/plan errors, invalid location/timezone, revoked access and unavailable sites fail without automatic retry. Failures retain only allowlisted safe text; raw exception messages, upstream bodies and API URLs/keys are not saved. Automatic retries stop after three attempts. An authorised Owner/Admin may explicitly restart a failed job, becoming its new requester; lifetime attempt totals and audit events remain intact. New jobs and manual retries are limited to 20 per organisation/hour, in addition to the provider-call limit.

The requester must still have verified Owner/Admin access and the site must remain active at execution and immediately before result persistence. Reads use site-scope checks; retry resolves job id, site and organisation together. The trusted worker command is not exposed through an HTTP execution endpoint. Public responses do not expose lease tokens. Queue, attempt, recovery, retry and completion transitions are audited.

Tariff/end-use mappings and full legacy reconciliation remain outstanding. The consolidated audit and remaining legacy parity work are recorded in [SPRINT_3_AUDIT.md](SPRINT_3_AUDIT.md).

## Audited energy corrections — 21 September 2026

Owner/Admin can correct a monthly reading or sourced conversion with a required reason. Each correction inserts a new immutable revision linked to its predecessor, retaining author/time and an audit event. Tenant-scoped history remains available to authorised readers. PostgreSQL enforces tenant lineage, sequential revisions, one successor per revision and one original reading per meter/month. Organisation locking and current-revision checks reject stale or concurrent corrections.

Current readings and coverage use the latest revision only. Reading corrections retain meter, month, source unit/fuel, legacy reference, original import batch and historical site-attribute snapshot. Quantity, estimated status, net cost, VAT, currency and end use may change; normalized energy and tax values are recalculated. Zero remains valid. Archived-meter readings can be corrected on an active site.

Conversion corrections may replace factor, source and validity dates. Overlap checks use current revisions with the same meter/unit/fuel. Existing readings keep their original conversion snapshot. Applying a replacement factor to an existing reading requires explicitly selecting that option in a reading correction; otherwise the prior factor is preserved. Changed factors invalidate stale workbook previews. Imported readings can be individually corrected without losing their original batch, and repeated batch commits remain idempotent.

This does not add bulk workbook corrections, period reassignment, deletion/voiding, arbitrary bill proration; driver/schedule corrections are delivered separately below. Only complete calendar months are accepted; overlapping independent readings for a meter/month are rejected.

## Driver and schedule corrections — 21 September 2026

Monthly observations and operating schedules now support required-reason corrections, author/time provenance and scoped revision history. Every correction appends a new immutable row, with tenant-bound predecessor links and one successor per revision. Owner/Admin writes recheck active site and current membership under the organisation lock; stale and concurrent corrections are rejected. Assigned-site readers may inspect history.

Observation corrections change value/source while fixing the month, driver and original import batch. Calendar-hour validation and zero semantics are unchanged. Current lists and annual coverage use only the latest revision; workbook imports continue to reject occupied driver/months, and recommitting a completed import never reverts a correction.

Schedule corrections can change name, hours, source and inclusive date range. Overlap checks consider only current revisions and exclude the predecessor being replaced. Released dates can host a new schedule; old dates remain visible in history. Schedules still do not generate actual observations or rewrite consumption attribute snapshots.

The UI provides correction forms with aligned Save/Cancel actions and expandable history. Errors retain inputs; successful saves reload current values. This does not add deletion/voiding, observation identity reassignment or bulk correction imports.
