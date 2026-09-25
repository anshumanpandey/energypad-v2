# Sprint 5 acceptance

## Current status — 2026-09-24

The six numbered Sprint 5 audit implementation gaps are now addressed: Overview, Waste & Savings, Site Performance, monthly targets/monitoring, carbon trends and reporting families. Delivered report foundations cover site energy, saved baseline/savings evidence and site/portfolio carbon. Earlier “next” and “remaining” paragraphs below describe the state at that slice's delivery; later sections supersede them.

This does not approve the statistical methodology or claim complete production acceptance. Advanced Analysis and dependent savings reports remain UNVALIDATED. The user's absolute tolerance of 0.99 and fully recalculated workbook confirmation remain accepted. Production-source reconciliation and later Sprint 6–7 workflows, report scheduling/archive/PDF/narratives remain separate work.

## Emission factor register

The first independent Sprint 5 slice adds organisation-owned, versioned emission factors under Carbon. It does not change the Sprint 4 statistical-method acceptance status.

- Owners and admins can add factors and append corrections; other active members can read the organisation's factor register. No site data is exposed by this register.
- Each factor stores fuel, geography code, reporting basis (location-based, market-based or direct), kgCO2e/kWh value, source/methodology reference and inclusive effective dates. Source text should identify the publisher, publication year, table or URL and emissions boundary. Geography codes are normalised to uppercase. No authoritative factors are invented or seeded.
- Values retain up to nine decimal places. Zero is accepted; negative, malformed and excessively precise values are rejected. Dates are stored as a half-open interval internally.
- Overlapping current versions for the same organisation/fuel/geography/basis/unit are rejected. Adjacent periods and different reporting bases can coexist.
- Corrections require a reason, retain identity, increment the revision and link to the previous version. Stale corrections are rejected. Database triggers prevent update, delete and truncate, validate lineage and reject overlaps; a composite foreign key prevents cross-tenant lineage.
- The Carbon page displays current versions, optional superseded versions and provenance. Successful submissions reset the form. Corrections retain old versions and their author/source metadata.
- API: GET/POST `/api/v1/organisations/:id/emission-factors`; POST `/:factorId/correct` accepts `{ factor, reason }`. GET includes full revision history.

Validation covers precision, inclusive date boundaries, concurrent submissions, overlap rejection, corrections, retained originals, immutable history, tenant isolation, viewer permissions and transactional audit events. Browser coverage exercises creation, form reset, correction, history visibility and reload persistence.

Next: reproducible carbon calculations referencing exact consumption and factor versions, with explicit handling of missing factors and periods spanning different factors. Target/monitoring persistence, FP15 imports, carbon summaries and reporting remain open. The registry alone does not calculate emissions or establish an approved carbon-accounting methodology.

## Saved carbon calculations

The Carbon page now calculates a selected meter's calendar-year emissions for an explicit geography and reporting basis. `monthly-exact-factor-v1` multiplies each immutable reading's normalised kWh by the matching current kgCO2e/kWh factor using 50-digit decimal arithmetic, sums unrounded monthly results and stores decimal strings. No display rounding enters the calculation.

Each of the twelve months must contain exactly one full-month consumption record and one matching factor covering that entire month. Missing consumption, incomplete factor coverage and mid-month factor changes block the annual total (null, never zero). Available monthly calculations remain visible for diagnosis. No daily proration or fallback between reporting bases/geographies is inferred. Estimated readings are visibly marked. Results describe the selected meter and basis, not a complete organisational emissions inventory.

Every run stores its definition, meter identity, algorithm version, author/time, monthly reading IDs/revisions, normalised inputs, conversion versions, factor IDs/revisions/sources and monthly results. Stored snapshots are immutable at database level. Subsequent reading/factor corrections affect new runs only. Retrying the same request key returns the saved run; reusing it with a different definition is rejected. Saving a run and its audit event is atomic.

API: GET/POST `/api/v1/organisations/:org/sites/:site/carbon`. POST accepts `meterId`, `year`, `geography`, `basis`, `requestKey` (UUID). History returns the latest 50 runs. Write access uses `analysis:write`; all reads and writes enforce tenant membership and site-manager assignments. API history remains readable for archived sites under the same scope, while the current UI site selector lists active sites.

Validation: isolated integration tests exercise full/missing coverage, factor boundaries, no mid-month proration, exact totals, factor and consumption corrections preserving original results, retry idempotency/conflict, read-only permissions, tenant/site isolation, database immutability and audit. The Carbon browser test covers a complete zero-valued result, blocked missing-year coverage and persisted history after refresh.

Next: broader carbon summaries and target/monitoring persistence with explicit coverage rules, followed by FP15 imports and report/export foundations. Pagination beyond the latest 50 runs and daily factor allocation remain outside this slice.

## Site carbon summary

The Carbon page now provides an on-demand summary for one site/year/geography/reporting basis. It selects the latest matching saved run per currently active meter (independently of the 50-run history display limit). Archived meters are excluded. This is explicitly a sum of registered active meters, not a net site inventory: main meters and submeters can measure overlapping energy, and no allocation or deduplication is inferred.

Each meter is READY, MISSING, BLOCKED or OUTDATED. The latest blocked run is never replaced by an older complete result. Complete snapshots are checked against current consumption IDs, factor IDs and the calculation algorithm version in a repeatable-read transaction. Corrections invalidate the live summary's total until a new run is calculated; historical runs remain unchanged. Estimated-consumption month counts and saved run IDs/timestamps accompany ready values.

The total uses exact decimal arithmetic and is available only when every active meter is ready. Empty sites and incomplete coverage produce null totals, not zero. Year, geography and basis are never mixed. The UI shows the check time, clears results when filters change and resets the summary after saving a new calculation. This is an explicit point-in-time check, not a live subscription to changes made elsewhere.

API: GET `/api/v1/organisations/:org/sites/:site/carbon/summary?year=2020&geography=GB&basis=LOCATION_BASED`. Read access uses the same tenant membership and site-assignment checks as run history. Summary reads do not create or modify saved calculations.

Validation adds missing/empty meter scope, multiple-meter decimal aggregation, archived meter exclusion, factor and reading correction detection, latest blocked run selection, geography separation and viewer/site-manager/tenant access tests. Browser coverage exercises zero-valued complete totals, blocked coverage, clearing filters and outdated-factor detection.

Next: target definitions and monitoring persistence. Portfolio summaries, FP15 emissions/target imports and export/report foundations remain open.

## Annual carbon targets and saved monitoring assessments

The Carbon page now supports absolute annual kgCO2e limits per meter/year/geography/reporting basis. Targets record a name and source/rationale. A unique target identity prevents duplicate independent targets for the same reporting scope. Corrections require a reason, preserve identity and append a new revision. The target input supports zero and up to twelve decimal places. Percentage-reduction, energy and intensity targets are not included in this slice.

An assessment explicitly selects a complete saved carbon run matching all four scope fields. `absolute-carbon-limit-v1` compares the saved actual to the target limit with 50-digit decimal arithmetic: actual <= limit is MET; otherwise EXCEEDED. Difference is actual minus limit, stored as an unrounded decimal string. Zero limits require no division. Incomplete runs and scope mismatches are rejected. This is an assessment of a selected historical calculation, not a statement that its inputs are current; the site summary remains the current-input check.

Target versions and assessments are immutable in PostgreSQL. Composite meter/target/run foreign keys enforce tenant and site lineage. Corrections retain existing assessments against the old target version. New assessments require the current target version; retrying an already saved assessment returns it even after a later correction. Target requests have idempotency UUIDs with payload conflict detection; target/run pairs uniquely identify assessment retries. Target/assessment writes and audit events commit atomically under the organisation lock. Permissions use `analysis:write`; reads enforce membership and site-manager assignments.

API under `/api/v1/organisations/:org/sites/:site/carbon/targets`: GET lists versions with assessments; POST creates a target; POST `/:id/correct` accepts `{ target, reason }`; POST `/:id/assess` accepts `{ runId }`. The UI resets successful target forms, exposes correction history and shows selected run and target IDs beside saved assessments. The run selector uses the latest 50 displayed calculations; APIs can assess any accessible matching saved run.

Validation extends the carbon integration suite with duplicate identities, retry conflicts, non-negative limits, incomplete/mismatched runs, scoped meter checks, decimal variance, exact-limit success, concurrent assessment retries, stale revisions, preserved assessments, database immutability, role/site isolation and audit. Browser coverage includes a zero-limit/zero-actual assessment, form reset, correction and preserved assessment after refresh.

Next: FP15 emissions/target workbook imports with named-sheet mapping, reviewed previews, atomic commits, corrections and retry protection. Portfolio carbon summaries, other target metrics and export/report foundations remain open.

## Carbon workbook imports (FP15)

The Carbon page now imports versioned emission factors and annual absolute carbon targets from a selected XLSX worksheet. The shared v1 mapping contract accepts `emissions` and `targets` kinds. Exact destination-column workbooks work without a template; custom headers/defaults use a saved JSON template. Multi-sheet workbooks require an explicit worksheet name or template. The UI lists excluded worksheets, row-level issues, mapped values and correction IDs/reasons before enabling a confirmed commit. Each batch is bounded to 120 non-empty rows and the existing workbook safety/size limits apply. Styled numeric cells and saved formula results use the shared workbook reader; formulas are not evaluated on the server.

- Emissions destinations: `fuel`, `geography`, `basis`, `unit` (`kgCO2e/kWh`), `factor`, `source`, `firstDay`, `lastDay`, optional `supersedesId` and `reason`. Factors are organisation-wide, even though the import is opened from a site's Carbon workspace. Owner/Admin permission is required.
- Target destinations: `meterCode`, `year`, `geography`, `basis`, `unit` (`kgCO2e`), `name`, `limitKgCO2e`, `source`, optional `supersedesId` and `reason`. Meter codes resolve only within the selected site and must still resolve to the same active meter at commit. Target permissions use `analysis:write`.
- Blank correction fields create new records; a correction requires both a current version ID and a reason. Existing identity, overlap, duplicate and immutable-lineage rules remain in force. Calculated emissions and monitoring assessments are not imported as factors or targets.

Preview exercises the same transactional insertion paths as commit, retaining successful simulated rows to detect intra-batch conflicts and rolling back all simulated destination/audit writes. Only the preview batch and preview audit remain. No destination write is approved by preview. Commit rechecks permissions and all constraints under the organisation lock, inserts all rows and audit events, and persists source-row/destination-ID/revision receipts in one transaction. Any stale conflict rolls back the whole batch. Preview evidence is immutable; committed batches and receipts cannot be rewritten or deleted. Re-previewing creates a new batch unless the same mapped-sheet fingerprint has already committed. Concurrent/repeated commits return the original receipt. Changes only to excluded-sheet contents do not create duplicate imports.

API: POST `/api/v1/organisations/:org/sites/:site/carbon/imports?kind=emissions|targets` with XLSX bytes and optional `sheet` / JSON `template` query values. POST `/:batchId/commit` requires `{ "confirmed": true }`. Uploads are limited to 20 per organisation per hour. Batch deduplication is scoped to organisation/site; factor overlap rules still prevent duplicate factor registration from another site.

Validation: dedicated isolated integration tests cover named-sheet templates/defaults, excluded sheets, cached formula values including zero, unrounded precision, preview rollback, intra-batch conflicts, stale-commit whole-batch rollback, factor/target correction lineage, immutable receipts, concurrent commit/re-upload retries and role/revocation checks. Existing carbon and factor integration suites cover the refactored shared insertion paths. Browser coverage exercises both destinations, named-sheet exclusion, confirmation gating, receipts and refreshed target rows.

Remaining: portfolio carbon summaries, additional target metrics, export/report foundations and reconciliation against reviewed production source workbooks. These imports support the implemented factor and absolute-carbon-target destination contracts; no undocumented legacy worksheet semantics are inferred.

## Portfolio carbon summaries

The Portfolio page now offers a coverage-aware carbon summary for a selected portfolio/year/geography/reporting basis. It reuses the site's current-input checks inside one repeatable-read transaction, rather than combining independently timed requests. Results include active sites and their active meters only; current portfolio membership determines scope. Archived portfolios are unavailable. Empty portfolios return EMPTY with a null total, and an included site without active meters prevents a complete portfolio total.

Each site exposes its status, exact decimal subtotal, per-meter coverage, estimated-consumption counts and saved run IDs/timestamps. The aggregate is returned only when every included site's summary is COMPLETE. Missing, blocked or outdated meter results withhold the portfolio aggregate; available site subtotals remain visible for diagnosis. No geography or reporting basis is mixed, and no main/submeter overlap deduction is inferred. All rows share the same check timestamp.

Read access requires organisation membership. Site managers receive only assigned active sites in that portfolio; no inaccessible site names, rows or counts are returned. Their result is always labelled ASSIGNED_ACTIVE_SITES, never represented as whole-portfolio coverage. A portfolio without an assigned active site is unavailable to them. Other active roles receive PORTFOLIO_ACTIVE_SITES scope, consistent with existing site access.

API: GET `/api/v1/organisations/:org/portfolios/:portfolio/carbon?year=2020&geography=GB&basis=LOCATION_BASED`. This is an on-demand read and does not create or alter saved runs. Changing UI filters clears the displayed result; users recheck after edits or membership changes.

Validation extends integration coverage for multi-site decimal sums, saved-run provenance, empty/missing-meter sites, archived and moved sites, outdated inputs, read-only access, assigned-site restriction and archived portfolios. Browser coverage checks a complete portfolio total, an added empty site blocking the total, visible coverage counts and result clearing on filter change. Existing site summary checks remain covered after extracting the shared transaction helper.

Next: report/export foundations. Additional target metrics and reconciliation against reviewed production source workbooks remain open.

## Carbon reporting and export foundation

Site and portfolio summary results now offer CSV and JSON downloads; the Reports page provides entry links. Each download rechecks permissions and current coverage rather than trusting client-supplied summary data. Reports use the `carbon-report-v1` contract with subject, organisation, explicit site/portfolio/assigned-site scope, filters, check timestamp, coverage status, exact decimal totals and per-site/meter details. Incomplete or empty totals remain null in JSON and blank in CSV, with their status retained.

JSON includes the complete immutable snapshots of only those saved runs referenced by the authorized summary, including algorithm versions, reading/factor IDs and revisions, conversion references, source text and monthly results. CSV uses REPORT, SITE, METER and MONTH record types in one fixed column schema. MONTH rows are explicitly historical evidence; the METER status determines whether they are current. No aggregation of exported row types should be inferred (they deliberately contain both totals and supporting monthly detail). CSV fields are quoted and potentially executable spreadsheet text prefixes are neutralized. JSON retains original text and exact decimal strings; spreadsheet software may auto-format numeric CSV fields when opening them.

Routes: GET `/api/v1/organisations/:org/sites/:site/carbon/report` and `/api/v1/organisations/:org/portfolios/:portfolio/carbon/report`, with `year`, `geography`, `basis`, and `format=csv|json` (JSON by default). Downloads are attachments, use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and run through the same authentication/problem-response wrapper as other API routes. Site managers receive only their assigned site data and run evidence. Neither downloads nor client-provided filters grant access to additional sites.

Exports are point-in-time files retained by the downloader; they do not create a server report archive or a new saved calculation. Scope/coverage can therefore differ from a previously displayed summary if data or permissions changed. Scheduled reports, PDF rendering, report archives and other report families are not delivered by this foundation.

Validation: five unit tests cover null versus zero, exact decimals, record types, historical evidence labels, empty scopes, CSV quoting and formula-prefix protection. Expanded integration tests cover full run evidence and assigned-site export isolation. Browser coverage downloads and inspects site JSON and incomplete portfolio CSV, checks attachment/no-store headers, rejects unsupported formats and confirms unauthenticated requests are denied.

Remaining: additional target metrics, the other planned analytics surfaces, broader reporting formats/archive/scheduling and reviewed production-source reconciliation. Sprint 5 is not yet claimed complete.

## Analytical Overview (audit point 1)

Overview now replaces workspace onboarding with a site/calendar-year performance screen. The site selector includes only accessible active sites; forged site IDs are rejected. Geography and reporting basis are explicit carbon filters. Energy, recorded net cost and current saved carbon totals are read in one repeatable-read transaction, using active meters and current reading revisions. Annual energy requires all twelve full months for every included meter. Net cost additionally requires all costs and one common currency; VAT is excluded and no currency conversion is inferred. Missing totals remain unavailable, while real zero is preserved. Registered main/submeter overlap is disclosed.

The monthly table shows energy, cost, estimate counts and exact reading/revision/conversion references. Carbon coverage shows missing, blocked or outdated runs with their immutable run IDs and links to the carbon evidence/export workflow. Verified savings is explicitly unavailable while analytical results remain unvalidated, with a link to saved baselines and experimental analysis. No methodological approval is inferred and no historical record is rewritten.

Validation includes exact-decimal/zero/empty/partial/duplicate-month and mixed-currency unit cases, integration checks for complete and missing records plus tenant/assigned-site denial, and browser coverage for year-filter changes and narrow-screen rendering. The dedicated Waste & Savings and comparative Carbon dashboards remain separate audit points.

## Waste & Savings (audit point 2)

The workspace navigation now exposes Waste & Savings. It selects one saved analysis run at a time, including archived-site history, with paginated discovery and direct saved IDs. It shows actual, expected and adjusted expected energy, pre/post-NRA variance, signed direction and the stored monthly significance basis/threshold/decision. Complete period totals never sum overlapping or alternative runs. Incomplete results suppress totals; monthly undefined significance remains undefined. The page is explicitly experimental and does not claim verified savings or aggregate statistical significance.

`waste-impact-v1` derives financial estimates from the exact immutable consumption IDs in the analysis result: signed variance × (original net cost / original normalised kWh), with 50-digit decimal arithmetic. VAT is excluded. Missing cost/currency or zero energy prevents a rate; mixed currencies prevent a period cost total. Average recorded cost can include fixed charges, so it is labeled an estimate, not marginal tariff savings. No current reading replacement is substituted.

Carbon estimates require an explicitly selected immutable carbon run from the same tenant/site/meter. Each month must match the analysis consumption ID and have an available pinned factor; the signed variance is multiplied by that factor. A blocked annual carbon run can still supply valid individual months, but missing/mismatched months suppress the impact total. No current factor lookup or implicit geography/basis fallback occurs. The selected definition, carbon algorithm, factor IDs/revisions/sources, reading/conversion versions, analysis input hash, model, policy and NRA reference evidence remain visible. Reading/factor corrections leave the old pair of selected runs and derived impacts unchanged.

Validation: six focused unit cases cover signs, exact factor precision, missing/mismatched evidence, mixed currencies, zero values, partial totals and undefined significance. The analysis integration suite verifies scoped access, historical cost/factor evidence, correction reproducibility and archived history. Browser coverage exercises the new saved-run screen and mobile rendering. Opportunity conversion remains part of Sprint 6; this slice performs no opportunity or source-data writes.

## Site Performance / Benchmarking (audit point 3)

Site Performance is now available in workspace navigation. It compares active sites for an explicit year, full-year or calendar-month period, fuel, net-cost currency and optional site/site-type filters. The service authorizes membership and applies site-manager assignments before discovering filter options, meters, readings, targets or carbon evidence. Archived sites/meters are excluded. All source reads share a repeatable-read transaction.

`site-benchmark-v1` ranks either normalized kWh or recorded net cost. Every included active meter must have exactly one full-month reading for every selected month. Missing, duplicate or partial coverage yields an unavailable total and an unranked row. Costs additionally require every reading to have net cost in the requested currency; no currency conversion, tariff estimate or VAT is added. Zero is retained. Decimal comparisons avoid lexical/numeric precision ordering errors. Ascending/descending sorts keep nulls last, equal values share competition ranks, and site code/ID resolve display ties deterministically. Estimated readings remain visible and counted.

These are absolute registered-meter totals, not efficiency scores: floor area, weather, occupancy, activity and main/submeter overlap are not normalized or inferred. Site-type filtering helps users restrict comparisons. Monthly values include original currencies and source reading/revision/conversion evidence so exclusions can be understood.

For a full-year comparison, current annual carbon targets are summed only if every selected-fuel meter has a matching year/geography/basis target. Actual carbon uses the same meters' current, complete saved runs; missing/blocked/outdated calculations prevent the comparison. Actual-minus-target is negative below the limit and positive above it. Target IDs/revisions/sources and saved run IDs/statuses are exposed. Annual targets are never prorated to a month. Monthly energy/carbon target persistence and imports remain audit point 4; no unsupported energy targets are invented here.

Validation includes numeric/tie/null sorting, period coverage, currency mismatch, empty scope, decimal/zero values and evidence tests; integration verifies full/month/fuel filters, target correction comparisons, tenant and assigned-site isolation, forged site IDs and archived-site exclusion. Browser coverage exercises the ranking screen, period and metric changes, missing-data labels and mobile rendering.

## Monthly targets and utility monitoring (audit point 4)

Targets & Monitoring now preserves two explicit kinds in the immutable `MonthlyPlanVersion` ledger: `TARGET` (legacy dated consumption targets, source-unit quantities and optional target carbon) and `MONITORING` (legacy utility-monitoring plan energy/carbon and end-use associations). Neither is an actual consumption record, baseline prediction, saved carbon calculation or verified saving. Annual meter-carbon limits/assessments remain a separate existing mechanism.

Each monthly version pins site/tenant, fuel, source unit/energy quantity, optional target or required monitoring kgCO2e, explicit kWh-per-source-unit conversion factor and source, exact normalized kWh, conversion method, optional legacy reference, author/time and request key. Fixed kWh/MWh conversions are validated; physical units require an explicit sourced factor. Monitoring end-use codes resolve only within the same site/tenant/fuel and retain ID/code/name snapshots; association tags never multiply a quantity. Imported end-use mappings are pinned in preview and rechecked at commit.

`YYYY-ALL` repeats the supplied monthly quantity twelve times; it never divides an annual total. Manual creation is atomic across all months. Workbook previews expand every destination month visibly, roll back simulated destination writes/audits, and remain noncommittable if any source row fails. Selected named sheets and version-1 mappings support `monthlyTargets` and `monitoring`, styled/cached-formula values, source references and correction columns. Commit revalidates the entire batch under the organisation lock; conflicts roll back all new months. Receipts retain every destination ID/revision; retrying a committed upload or commit does not duplicate records.

Corrections append one month at a time, require a reason and retain kind/fuel/month/unit identity. Both stale corrections and duplicate original identities are rejected. Consumption targets may retain alternate source-unit representations, but monitoring has one identity per site/fuel/month. Database constraints validate lineage and scoped end-use references; update/delete/truncate triggers preserve history. Scoped reads include archived-site history; creation/correction/import require an active site and analysis-write permission. Membership/site assignment is rechecked on requests. Request-key conflicts are explicit.

Site Performance now compares normalized monthly energy targets with the same site/fuel/period's actual registered-meter total. Full-year targets require all twelve months. Missing months or multiple alternative-unit targets suppress the combined target instead of double-counting. Monitoring records remain separate. Exact target revision/source/conversion evidence is visible. These live comparisons do not rewrite historical saved assessments.

Validation includes contract tests; isolated database coverage for both mechanisms, end uses, month expansion, precise conversion, idempotency, correction lineage, database immutability, assigned-site access, import preview rollback, mapping defaults, import corrections, stale atomic commits and retries; and browser coverage for creation, clearing, correction/history, all-month XLSX preview/commit and mobile layout. Existing carbon calculation/import integration suites continue to pass. Migration `202609240005_monthly_plans` was applied to the verified local development database at 127.0.0.1:55432; no production deployment was performed.

## Carbon and portfolio trends (audit point 5)

Carbon and Portfolio now link to Carbon trends, with a site/portfolio selector, reporting and comparison years, geography and reporting basis. A two-year monthly chart, monthly coverage table, annual differences and per-site comparisons use exact decimal kgCO2e totals. Missing months break chart lines; real zero remains visible. Annual totals require all twelve months, and percentage change is unavailable when the comparison total is zero or missing.

Both years use the same current active, authorized sites and meters, including current portfolio membership; this is not historical membership reconstruction. Assigned-site restrictions apply before fetching readings, factors and saved runs in a repeatable-read transaction. Current registered meters may include main/submeter overlap, which is disclosed rather than inferred away.

Each meter/year selects the latest matching saved run. Monthly usability is checked independently: valid months from an incomplete annual run remain visible, while missing, blocked, superseded reading/factor or outdated-algorithm months produce gaps. Portfolio months require every included site and meter, including empty sites, to have usable coverage. Historical snapshots remain immutable after corrections. Expandable evidence exposes run IDs/versions/timestamps, reading revisions/conversions, factor IDs/revisions/sources and estimated flags. Changes describe energy and factor effects, not verified savings.

Validation: 212 unit tests passed, including decimal totals, zero values, partial annual coverage, corrections, empty scopes and year validation. Carbon integration passed with geography, correction freshness and assigned-site isolation checks. Browser coverage passed for site and portfolio comparisons, unavailable geography and mobile rendering. Typecheck, lint and formatting checks passed.

## Energy, baseline and savings reports (audit point 6)

Reports now offers energy, baseline and savings previews alongside existing site/portfolio carbon exports. Site discovery includes authorized archived history. Saved baseline/run selectors provide paged history and accept an exact version ID. Every preview and download authorizes current membership and assigned-site scope. Archived history remains readable only where the current access policy permits it.

`analytics-report-v1` carries family, tenant/site, period, status, explicit units, summary, result rows and complete nested evidence. Energy reports apply the Overview monthly coverage rules to current saved reading revisions and current active meters, preserving original quantities, conversion IDs/factors/versions, costs/currencies, estimated flags and revision/provenance metadata. Empty/incomplete months and mixed-currency costs stay unavailable; zero remains zero. Energy reads share a repeatable-read transaction. Meter scope and the main/submeter overlap limitation are explicit.

Baseline reports pin one immutable baseline version, definition, input hash, assembly/driver inputs, model coefficients/diagnostics, fit algorithm/policy, revision and saved fit rows. Savings reports reuse the same saved-run impact computation as Waste & Savings: expected/actual and pre/post-NRA kWh, monthly significance, estimated financial impacts and optional carbon impacts pinned to a selected saved carbon run with matching reading revisions. Original readings, baseline/run snapshots and factor evidence accompany results. Corrections never refit historical models or rewrite saved savings. Both report families retain UNVALIDATED status and do not establish verified savings.

Preview and exports consume the same report contract. JSON preserves exact decimal strings and nested inputs. CSV is a documented long-form `path,type,value` export using escaped JSON Pointer paths, with explicit null/boolean/empty-collection types and spreadsheet formula protection. It includes every report/evidence field rather than truncating snapshots. Downloads recheck access; a content fingerprint rejects changed inputs with HTTP 409 and requests a new preview. Files use attachment, no-store and nosniff headers. No server-side report archive or new calculation is created.

Validation includes contract/CSV/attachment/fingerprint tests, database coverage of all three families, original evidence after reading/factor corrections, archived history, tenant/site-manager access, revoked access and stale-preview rejection. The targeted browser flow passed for all families, real JSON/CSV downloads, stale-preview/format errors and mobile rendering. All 216 unit tests, the analysis database integration suite, typecheck, lint and formatting checks passed. No schema migration is required.
