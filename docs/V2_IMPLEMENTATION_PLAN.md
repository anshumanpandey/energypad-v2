# EnergiePad V2 implementation plan

Prepared 17 September 2026 from EnergiePad_Master_Product_Technical_Specification_v2.docx and a preliminary inspection of this repository.

## Scope and interpretation

The current request is to read and plan. This document is a proposed delivery plan, not authorization to implement, migrate production data, deploy, or run the example prompts embedded in the specification. No application changes are part of this planning task.

Use the V2 addendum's Sprint 0–8 sequence. It adds discovery and migration requirements to the original Sprint 1–8 sequence. Appendix B's example request to implement Sprint 1 is superseded in the document's proposed sequence by the later discovery milestone.

The intended result is a commercial, multi-tenant energy SaaS: onboarding and imports lead to reproducible energy/carbon analytics, evidence-backed opportunities, AI explanations, reports and subscription controls. Deterministic services own calculations; AI explains stored results.

## Findings from the current repository

This is a preliminary assessment, not the complete Sprint 0 inventory.

| Evidence                                               | Finding                                                                                                                                           | Planning consequence                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Root package.json, src/lib/db/knexfile.ts, migrations/ | Root API uses Express, TypeScript, Knex and PostgreSQL configuration.                                                                             | Inventory this API separately; do not assume all legacy data is MySQL. Confirm the actual production schema.  |
| Energiepad/energeiapdapi/package.json                  | Nested API uses Express, Sequelize and MySQL.                                                                                                     | Treat it as a second reference snapshot; determine which endpoints remain relevant.                           |
| Energiepad/energiepadui/package.json and src/App.tsx   | React 17/CRA UI with business settings, sites, utility/emissions, energy patterns/logs, reviews/programmes, user management and analytics routes. | Map useful behaviour into the new UX; assess marketing routes and duplicate JS/TS files explicitly.           |
| src/routes/v1/dashboard.route.ts                       | Root API exposes reports, carbon footprint, portfolio and energy waste.                                                                           | Compare UI calls with both APIs before deciding a capability is missing.                                      |
| src/services/waste/ and tests                          | Existing regression and NRA logic plus historical expected values.                                                                                | Use as compatibility evidence after the Excel references, not as unquestioned mathematical truth.             |
| src/lib/excel/BusinessExcelClient.ts                   | Legacy import declares a password field.                                                                                                          | New pipeline must exclude credentials from persistence, logs and downloadable errors; use secure invitations. |
| Initial git status                                     | Existing modified and untracked application/test files and nested repository changes.                                                             | Preserve this work and identify the reference revision before restructuring anything.                         |

Fixture availability found during planning:

- Present: test/fixtures/business_example_v3.xlsx.
- Present outside the repository: /home/leonardo/Downloads/Multi Routine Adjustment Plus NRA V2.xlsx.
- Not found in the checked repository and Downloads locations: Single Routine Adjustment V2.xlsx and Multi Routine Adjustment V2.xlsx.
- Workbook contents and expected cells have not yet been validated. Filename presence is not acceptance of a golden fixture.
- The nested legacy source is available; equivalence to the document's referenced energypad-ui.zip has not been established.

## Delivery structure

Proposed code organization, subject to Sprint 0 review: apps/web for the Next.js application/BFF; packages/domain for business rules and deterministic calculations; packages/db for Prisma; packages/integrations for auth, weather, billing, storage and jobs; test-fixtures for approved immutable references; docs for requirements and decisions. Keep the legacy sources available during comparison and migration.

Follow the specification's target stack: Next.js 16+ App Router, React/TypeScript, Tailwind/shadcn, Recharts, PostgreSQL/Prisma and Zod. Select and verify compatible package versions at implementation time. Auth.js versus Clerk and Trigger.dev versus Inngest remain provider decisions behind adapters. Private object storage, a dedicated AI service and Stripe integrations stay server-side.

The proposed navigation is Overview, Sites, Energy, Carbon, Opportunities, AI Analyst, Reports, Data, Settings and Billing. Portfolio filters and comparisons are first-class. Place statistical diagnostics under Advanced Analysis. Lead dashboards with cost, consumption, tCO2e, identified waste, waste rate and saving opportunity.

## Sprint sequence and acceptance gates

Each sprint ends with evidence mapping requirements to implementation and tests. Dependent work begins after its preceding gate passes; the Sprint 4 fixture gate is mandatory before accepting analytical results.

| Sprint                      | Deliverables                                                                                                                                                                                                                                                    | Acceptance gate                                                                                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Discovery                 | Inventory both APIs, UI routes/service calls, models/fields, imports, calculations and tests. Produce LEGACY_FEATURE_INVENTORY.md, FEATURE_PARITY.md, MIGRATION_MAP.md and COMPATIBILITY_DECISIONS.md. Register fixtures and unresolved evidence.               | Review inventory/dispositions, source provenance and decisions needed for foundation. Record missing fixtures as a Sprint 4 blocker.                                                                                                                                                           |
| 1 Foundation                | New app shell/design system, Prisma/Postgres, auth adapter, organisations, memberships, invitations, RBAC, assigned-site access model, audit and CI.                                                                                                            | Register → create organisation → invite → accept invitation works. Role and tenant isolation tests pass, including guessed IDs and cross-tenant relationships. Lint, typecheck and foundation tests pass.                                                                                      |
| 2 Sites and import          | Portfolio/site/meter CRUD; historical site attributes; Excel sheet detection, mapping, validation, preview, commit and error download; import batches and idempotency.                                                                                          | Business workbook maps to approved fields. Credential columns are rejected or removed under the chosen policy. Retry does not duplicate data; errors are actionable and tenant-safe.                                                                                                           |
| 3 Energy and weather        | Consumption records, normalized units and versioned conversions, end-use, cost/VAT, quality rules, historical drivers, weather abstraction and retryable jobs.                                                                                                  | Import/enrich at least 12 months per site; missing/overlapping/duplicate periods and missing drivers are surfaced. Provider failures recover visibly without fabricating data. Every retained legacy energy field has a mapping.                                                               |
| 4 Calculation compatibility | Pure TypeScript one-, two- and three-driver regression, statistics, baseline versions, NRA and immutable analysis snapshots.                                                                                                                                    | All three approved workbooks reproduce coefficients, fitted values, residuals, R², SE, t/p values, variance, significance and NRA within approved tolerances. Approved legacy edge cases pass.                                                                                                 |
| 5 Carbon and analytics      | Versioned emission factors and carbon results; target/monitoring persistence and FP15 named-sheet emissions/target imports with versioned templates; Overview, Waste & Savings, Site Performance/Benchmarking, Portfolio and Carbon; report/export foundations. | Every KPI traces to inputs, units, algorithm, model and factor versions. Historical results remain reproducible after corrections. Retained legacy analytics have destinations. Emissions and target workbook previews, atomic commits, corrections and retry protection pass FP15 acceptance. |
| 6 AI and opportunities      | Tenant-scoped analytical tools, structured AI responses, usage/prompt/tool audit, opportunity/action workflow and savings verification.                                                                                                                         | AI cites stored deterministic results; cross-tenant retrieval and malicious prompt tests fail safely. Opportunity progresses from detected through verification with owner, evidence and outcome.                                                                                              |
| 7 Commercial                | Stripe plans, trials, monthly/annual billing, upgrades/downgrades/cancellation/payment failure, server-side entitlements, AI quotas and scheduled reports.                                                                                                      | Signed webhook processing is idempotent and resilient to duplicate/out-of-order events. Limits and feature access follow subscription state. Scheduled reports preserve result versions.                                                                                                       |
| 8 Admin and migration       | Admin controls, audited/time-limited impersonation, observability, retention/export/deletion, backup restore exercise, migration adapters, reconciliation and cutover runbook.                                                                                  | Dry-run counts and totals reconcile; security and critical E2E tests pass; restoration and rollback are demonstrated before production cutover. Legacy database is preserved.                                                                                                                  |

Entitlement interfaces and plan definitions belong in Sprint 1 so feature checks can be added as features arrive; Sprint 7 connects real billing. Tenant authorization, auditing, version metadata and observability start with each feature rather than being deferred to Sprint 8. Draft the cutover runbook during discovery and refine it against dry-run evidence.

## Sprint 0 execution checklist

1. Record reference revisions and working-tree state for root and nested sources. Confirm which source and database correspond to production.
2. Enumerate UI routes, reachable screens, API clients, backend routes/controllers/services, migrations/models, import schemas and tests. Include legacy concepts such as floors/tenants, operating patterns, programmes, tips and targets rather than silently dropping them.
3. Assign each feature Retain, Redesign, Replace or Retire; map it to a V2 module, sprint, evidence location and acceptance test. Distinguish observed behaviour from inferred intent.
4. Map every legacy field to destination, transformation, units, ownership, history policy and reconciliation rule. Preserve source-system identity with externalLegacyId and avoid ID collisions between sources.
5. Acquire the two missing approved workbooks. Register hashes and provenance for all four fixtures; inspect formulas, cached values, units, input ranges and expected cells without altering originals. Determine whether import fixtures contain sensitive data before committing them.
6. Document conflicts with their proposed resolution and test. Obtain review of unresolved product/calculation choices; do not equate current output with approved behaviour.
7. Prepare PRODUCT_SPEC.md, ARCHITECTURE.md, DATA_MODEL.md, CALCULATION_ENGINE.md, AI_SPEC.md, SECURITY.md, ADMIN_SPEC.md, SUBSCRIPTIONS.md and an initial CUTOVER_RUNBOOK.md. Propose AGENTS.md conventions when implementation is authorized.
8. Produce the Sprint 1 schema proposal, access matrix, UI flow and test checklist once discovery findings are reviewed.

## Data model direction

Use UUID identities, UTC audit timestamps, numeric/decimal storage for quantity/money/carbon and organisation ownership on tenant records. Resolve tenant context from authenticated membership and enforce it in services, jobs, storage access and database relationships, not only UI filters.

- Identity: User, Organisation, Membership, Invitation, SiteAssignment and AuditEvent. Platform administration is separate from ordinary organisation roles.
- Site domain: Portfolio, Site, Meter, SiteAttributeHistory and OperatingSchedule. Preserve location, external code, population, floor area, operating hours, currency and tax semantics.
- Energy domain: EnergySource/FuelType, UnitOfMeasure, UnitConversionVersion, EndUse, ConsumptionRecord, ImportBatch, ImportRowError and QualityIssue. Store source and normalized values, actual/estimated status, period boundaries, provenance and correction lineage; monthly first, interval-ready later.
- Analytics: DriverDefinition, DriverObservation, WeatherObservation, BaselineVersion, NRAAdjustment, AnalysisRun and AnalysisResult. Capture provider/station, degree-day base temperatures, methodology, evidence/approval and algorithm/input snapshots or hashes.
- Carbon: EmissionFactorVersion and CarbonResult, with fuel/geography/unit/valid dates/source and version provenance. Updating factors creates new results rather than rewriting historical reports.
- Outcomes: Opportunity, Action, Verification, Target, Report and ReportSchedule. Model the documented opportunity transitions and include report period, data/model/factor versions and AI-assisted flag.
- Commercial/AI: Plan, Entitlement, Subscription, BillingEvent, UsageLedger and AIInteraction. Persist prompts/models/tool metadata, quotas and feedback with appropriate retention and secret redaction.

Exact tables, constraints and indexes are Sprint 1 design work. Tenant foreign-key consistency, idempotency constraints and period overlap rules need explicit design before migrations are implemented.

## Calculation decisions to resolve

The specified sign convention is expected minus actual: positive saving, negative waste. NRA multiplies expected consumption by reporting/baseline hours and reporting/baseline population. Carbon is normalized consumption multiplied by the applicable versioned factor. Significance uses absolute variance ≥ 2 × regression SE.

Initial conflicts/candidates from src/services/waste/waste.service.ts:

| Observed code                                                        | Concern                                                                             | Planned decision/test                                                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Single-driver significance uses signed waste ≥ threshold (line 199). | Negative waste is treated differently from positive saving.                         | Use the specified absolute comparison; test equal-magnitude positive/negative cases and threshold equality.         |
| SE divisors are fixed at 22, 20 and 9 (lines 181, 414, 626).         | Values assume particular sample sizes.                                              | Reconcile with workbook sample counts and degrees of freedom; test other valid sample counts and insufficient data. |
| Daylighting column inclusion checks truthiness (line 22).            | A valid zero value can omit a matrix column.                                        | Distinguish zero from missing; test zero-daylight observations.                                                     |
| NRA result lookup uses find(i => i.date) (line 529).                 | It can select the first dated result rather than the matching period.               | Match the full analysis dimensions; test multiple reporting months/sites/fuels.                                     |
| Some reporting/NRA lookups match date alone.                         | Same-date records can be associated incorrectly if multiple dimensions are present. | Test shuffled, multi-site, multi-fuel inputs and enforce keyed joins.                                               |
| Legacy tests assert rounded values with exact equality.              | They do not establish raw numerical compatibility.                                  | Preserve historical intent separately and add approved absolute/relative floating-point tolerances.                 |

These are static findings, not runtime reproductions. Sprint 0 must trace call paths and fixtures before documenting final resolutions.

Also decide minimum baseline length, constant series, singular/collinear drivers, missing-data policy, zero NRA denominators, negative predicted consumption, p-value conventions, R² verdict configuration, and whether post-NRA significance uses an unchanged or adjusted threshold. Define waste-rate denominator, VAT inclusion, cost valuation, currency aggregation and aggregation of significant waste before publishing KPIs. Do not invent these policies from labels.

## Verification and migration

Use unit tests for numerical/domain rules, integration tests for tenant boundaries and adapters, and Playwright for onboarding, import, dashboards, opportunities, AI and billing. Every behaviour-changing sprint supplies tests and a traceable acceptance checklist. Test tenant isolation for routes, jobs, signed-file URLs, reports and AI tools.

Do not run the existing root test command blindly: its pretest script tears down and starts Docker services. Establish an isolated test environment and assess current test failures separately from V2 acceptance.

Migration starts with a production schema inventory and sanitized sample, then repeatable adapters with dry-run mode, counts, rejected rows, stable legacy identifiers and resumability. Reconcile organisation/site counts, monthly consumption by fuel, costs/VAT, carbon and approved waste outputs. Migrate identity/email only and require secure activation; never copy reusable credentials. Plan the final write freeze/read-only window, final reconciliation, cutover checks, rollback triggers and treatment of any V2 writes after cutover.

## Decisions and dependencies

Sprint 1 was authorised by the user after discovery. The isolated app location, auth adapter and role boundaries are recorded in SPRINT_1_DESIGN.md. Production source/schema confirmation remains a prerequisite for migration, not for the isolated foundation.

Before Sprint 3: select weather provider/geography coverage, methodology, supported currencies/units and historical driver policies.

Before Sprint 4 acceptance: obtain and validate all three regression workbooks; approve tolerances, edge-case policies and compatibility decisions. Missing fixtures do not prevent drafting architecture or completing legacy discovery.

Before commercial launch: settle actual prices, trial duration, quota amounts, downgrade/over-limit behaviour and the 100-site boundary (Professional is 26–100 while Enterprise is described as 100+). Confirm retention/data residency, backup objectives and production cutover ownership.

No reliable calendar estimate is assigned yet: team capacity, production data volume, fixture availability and parity scope are unresolved. Sprint numbers describe dependency milestones, not fixed-duration commitments.

## Execution status

Sprint 0 repository discovery was subsequently executed on 17 September 2026. Discovery references: [LEGACY_FEATURE_INVENTORY.md](LEGACY_FEATURE_INVENTORY.md), [FEATURE_PARITY.md](FEATURE_PARITY.md), [MIGRATION_MAP.md](MIGRATION_MAP.md) and [COMPATIBILITY_DECISIONS.md](COMPATIBILITY_DECISIONS.md).

The discovery covers 27 UI routes, 47 root and 19 nested API endpoints, and 30 source-derived tables with 174 fields. It found hardcoded analytical inputs, import layout drift and inconsistent tenant ownership checks. Application code and fixtures remain unchanged. Production schema confirmation and golden-fixture approval remain outstanding for migration/calculation milestones. The original NRA shifting-range discrepancy claim was withdrawn after direct XML inspection on 22 September; reference approval remains outstanding. Sprint 1 is implemented in `apps/web`; see [SPRINT_1_ACCEPTANCE.md](SPRINT_1_ACCEPTANCE.md) for scope and verification evidence.

Sprint 2 sites and import is now implemented in the isolated V2 application. Portfolio/site/meter management, append-only effective-dated attributes, tenant-scoped XLSX staging/mapping/preview/commit and retry protection are covered by local integration and browser gates. See [SPRINT_2_DESIGN.md](SPRINT_2_DESIGN.md) and [SPRINT_2_ACCEPTANCE.md](SPRINT_2_ACCEPTANCE.md) for scope, defaults, executed checks and the new-site-only import boundary. Energy records, units/conversions and weather remain Sprint 3. Production source confirmation and Sprint 4 fixture decisions are still outstanding.

Sprint 3 is in progress. Its first deliverable adds manual monthly consumption for kWh/MWh meters, versioned dimensional conversion snapshots, explicit net/VAT/gross amounts, historical site-attribute snapshots and per-year missing-month checks. See [SPRINT_3_DESIGN.md](SPRINT_3_DESIGN.md) for delivered consumption imports, physical-unit conversions, monthly observed drivers, operating schedules and versioned weather enrichment, durable jobs and audited reading/conversion/driver/schedule corrections, and the remaining legacy-mapping and consolidated acceptance gates. This does not yet satisfy the full Sprint 3 acceptance gate.

The consolidated Sprint 3 audit is recorded in [SPRINT_3_AUDIT.md](SPRINT_3_AUDIT.md). Site end-use identities and versioned tariff destinations are delivered. Organisation-owned versioned fuel/use catalogs and explicit reading-to-use links are also delivered. Remaining work includes reviewed migration adapters, separate legacy occupancy/pattern/event preservation and consumption migration reconciliation. The executable combined import/driver/weather-recovery check is included in the integration suite.

The tariff/catalog migration dry-run adapter is delivered; see [LEGACY_TARIFF_DRY_RUN.md](LEGACY_TARIFF_DRY_RUN.md). It validates a reviewed manifest and reconciles source counts without database writes. Atomic apply/reuse and actual source reconciliation remain open.

### Tariff migration atomic apply milestone

The reviewed six-table tariff adapter now has an operator apply command with source-hash verification, current permission/site/conflict checks under the organisation lock, transactional destination and audit writes, and an immutable source-to-target receipt. Identical-batch retries reuse that receipt; unrelated existing destinations are not adopted. Real export reconciliation remains open. See LEGACY_TARIFF_DRY_RUN.md.

Occupancy history (audit point 1) now retains separate regular/irregular counts, explicit periods and end-use associations with immutable corrections and reviewed workbook preview/atomic commit. Legacy operating patterns, operational events, broader workbook scope and real-source reconciliation remain open.

Audit point 2 is delivered: end-use operating patterns retain annual active days and original temperature/unit/context evidence, with versioned corrections and atomic reviewed imports. Operational events (point 3), consumption provenance, workbook parity scope and real-source reconciliation remain open.

Audit point 3 is delivered: operational evidence with scoped end-use/date links, immutable correction history and reviewed atomic log imports. Next: consumption/meter provenance and migration (point 4); real-source tariff reconciliation and broader workbook parity scope remain open.

### Reviewed consumption/meter migration

Audit point 4 now has an executable operator preview/apply workflow for BusinessFuelsSize and UtilityConsumptions. Explicit meter-token/site/fuel/use mappings, tax/unit/conversion decisions and driver basis/conflict rules preserve source evidence without inferred allocations. Original timestamps, supplied VAT/cost/factor/population/hours are stored separately from calculated readings and remain unchanged by corrections. Immutable receipts provide source-to-target reconciliation, grouped totals and safe retries. Destination meters and conversions must be registered before migration; no real source export has been imported. See docs/LEGACY_ENERGY_MIGRATION.md for the input format, commands, review requirements and scope limits.

FP15 workbook scope is explicitly allocated across Sprints 2, 3 and 5 in [WORKBOOK_IMPORT_TEMPLATES.md](WORKBOOK_IMPORT_TEMPLATES.md). Sprint 3 now supports named-sheet consumption/driver/setpoint imports and reusable v1 mappings. Emissions and target imports remain required Sprint 5 deliverables with their destination models; they are not claimed as implemented. Multi-sheet workbooks are processed as separate reviewed batches, not an all-sheet transaction.

Sprint 4 preparation now has an executable read-only fixture availability/hash check (`npm run sprint4:readiness` in apps/web) and [SPRINT_4_DESIGN.md](SPRINT_4_DESIGN.md). The recorded [updated fixture report](sprint-4-fixture-readiness-verified.json) confirms two missing workbooks and the unchanged, unapproved NRA source. Preparation does not close Sprint 3 reconciliation or approve calculation policies/results; the numerical compatibility gate remains mandatory.

### Current Sprint 4 status — 24 September 2026

The experimental regression/reporting engine, immutable baselines and runs, Advanced Analysis UI, diagnostics, history, NRA review, and audit points 1–5 are delivered. All three original workbook references are now available and hash-pinned; the earlier missing-file and preparation-only notes above are historical. See [Sprint 4 acceptance](SPRINT_4_ACCEPTANCE.md) and [workbook review](SPRINT_4_WORKBOOK_REVIEW.md).

The next gate is reviewed native Excel recalculation, expected outputs, numerical tolerances and methodological decisions, then an approved golden suite. The `sprint4:review` command generates a fresh, private Markdown comparison with the documented draft tolerances and cell-level review flags. It cannot approve results. Sprint 3 real-export reconciliation remains separately open; Sprint 5 dependent analytical work has not started.

The next Sprint 4 preparation slice provides `sprint4:evidence` and [native Excel evidence intake](SPRINT_4_NATIVE_EVIDENCE.md). Original/output/evidence hashes, rebuild metadata and input-change/restore observations can now be checked consistently. Native evidence, tolerance interpretation and approval are still required before a golden acceptance verdict.

### Tolerance decision resolved

The user approved absolute tolerance 0.99 (relative 0) and confirmed full recalculation of all three supplied references. Fresh comparison passes 305 numerical values and 36 exact significance flags. The confirmation is user-attested, not an independently observed Excel rebuild. Earlier requests to clarify “0.99” or confirm recalculation are resolved. The remaining Sprint 4 gate concerns methodology/coverage approval and its integration into full compatibility acceptance; application snapshots are not relabelled by this comparison.

The registered-cell numerical compatibility test is now executable with `npm run test:compatibility -- <reference-directory> <new-report.json>` in `apps/web`. It verifies exact output coverage and source identities, returns exit 0 for a numerical pass, and passed all 305 values/36 significance checks on the supplied files. Missing or modified fixtures cannot pass. Broader methodology/coverage acceptance remains separate from this scoped test.

### Sprint 5 progress — emission factor register

The first independent slice now provides an organisation-scoped Carbon factor register with source/methodology references, geography, reporting basis, effective dates and decimal kgCO2e/kWh factors. Append-only corrections preserve history; overlap and tenant checks protect factor selection. The UI supports entry, correction and provenance/history inspection. See `SPRINT_5_ACCEPTANCE.md`. Next is version-pinned carbon calculation; Sprint 4 methodological acceptance remains separate from the passing numerical workbook compatibility gate.

### Sprint 5 progress — reproducible meter carbon calculations

Carbon now provides saved calendar-year calculations per meter/geography/reporting basis. Each run pins monthly consumption and factor versions, conversion references, exact decimal values and algorithm version. Incomplete input/factor coverage blocks the annual total; mid-month factors are not prorated. Immutable history, retry keys, audit and tenant/site authorization are implemented. Subsequent corrections affect new runs only. Broader summaries, targets/monitoring, FP15 imports and exports remain open.

### Sprint 5 progress — site carbon summary

The Carbon page now summarizes the latest saved run per active meter for an explicit site/year/geography/basis. It reports missing, blocked and outdated runs, checks source versions, and withholds the aggregate unless every active meter is ready. Exact totals retain run provenance and estimated-month counts; archived meters are excluded and overlapping meter scopes are explicitly disclosed. Target/monitoring persistence is the next slice; portfolio summaries, FP15 imports and reporting remain open.

### Sprint 5 progress — annual carbon targets and monitoring

Versioned absolute annual carbon limits can now be created and corrected per meter/year/geography/basis. Saved assessments compare an explicitly selected complete matching carbon run against the exact target revision, preserving MET/EXCEEDED results and decimal variance. Corrections retain historical assessments; tenant/site authorization, database immutability, duplicate prevention, retries and transactional audit are covered. This slice covers carbon limits, not percentage-reduction, energy or intensity targets. FP15 emissions/target imports are next; portfolio summaries and reporting remain open.

### Sprint 5 progress — carbon workbook preview and commit

FP15 imports now support emissions factors and absolute annual carbon targets with selected worksheets, reusable v1 mappings/defaults, reviewed row previews, explicit corrections and atomic commits. Immutable source-row receipts, scoped meter resolution, stale-conflict rollback and retry deduplication are covered. Styled cells and saved formula results use the shared reader. Portfolio summaries, additional target metrics, exports/report foundations and reviewed production-source reconciliation remain open.

### Sprint 5 progress — portfolio carbon coverage

Portfolio now summarizes current saved carbon runs across its active sites using one consistent database snapshot. It shows per-site/meter coverage and source run references, and withholds totals for incomplete or outdated inputs. Site managers receive a clearly labelled assigned-site subset without hidden-site names or counts; archived and moved sites follow current membership. Report/export foundations are next, with additional target metrics and reviewed production reconciliation still open.

### Sprint 5 progress — carbon report/export foundation

Site and portfolio carbon summaries now export versioned CSV/JSON reports with coverage, explicit scope and immutable source-run evidence. Exports recheck access/current coverage, preserve incomplete totals and include calculation versions and monthly reading/factor references. CSV escaping, private attachment headers and assigned-site evidence isolation are tested. Reports provides links to these flows. Other analytics surfaces, additional target metrics and broader reporting remain open; this is not Sprint 5 completion.

### Sprint 5 progress — analytical Overview

Audit point 1 is addressed with a site/year Overview showing current energy, recorded net cost and saved-carbon KPIs, monthly coverage and immutable evidence references. Carbon filters are explicit; missing/stale inputs and mixed currencies suppress totals, and zero remains a value. Verified savings remains unavailable pending analytical approval, with a link to experimental saved analysis. See SPRINT_5_ACCEPTANCE.md and SPRINT_5_AUDIT.md for scope and the remaining numbered gaps.

### Sprint 5 progress — Waste & Savings

Audit point 2 now has a dedicated saved-run screen with pre/post-NRA energy variance, saved monthly significance, average-net-cost financial estimates and optional pinned-factor carbon estimates. Immutable source IDs and calculation assumptions remain visible; missing evidence suppresses impacts and all results retain the experimental status. The implementation deliberately selects one run rather than aggregating competing baselines or overlapping periods. Opportunity conversion remains Sprint 6 work. See SPRINT_5_ACCEPTANCE.md.

### Sprint 5 progress — Site Performance / Benchmarking

Audit point 3 now has a dedicated site comparison destination with fuel/year/month/site/type filters, kWh or same-currency net-cost rankings, coverage-aware exclusions, deterministic ties, monthly evidence and annual carbon target comparisons. Absolute totals are explicitly distinguished from normalized efficiency. Target-model expansion remains audit point 4. See SPRINT_5_ACCEPTANCE.md.

### Sprint 5 progress — monthly targets and monitoring parity

Audit point 4 adds distinct monthly consumption/carbon targets and utility-monitoring plans, immutable corrections and end-use snapshots, explicit normalization, all-month expansion, scoped history/forms, and named-sheet imports with reviewed previews, atomic commits and retries. Site Performance now compares complete, unambiguous monthly energy targets. Existing annual carbon targets and historical assessments remain intact. See SPRINT_5_ACCEPTANCE.md and WORKBOOK_IMPORT_TEMPLATES.md.

### Sprint 5 progress — carbon and portfolio trends

Audit point 5 adds two-year carbon comparisons for sites and portfolios: monthly charts and coverage, annual changes, per-site comparisons and immutable source evidence. Explicit geography/basis and the same current active cohort apply to both years. Usable months from incomplete annual runs remain visible; missing or stale evidence suppresses affected totals. Historical portfolio membership is not reconstructed. See SPRINT_5_ACCEPTANCE.md. Broader report families remain audit point 6.

### Sprint 5 progress — energy, baseline and savings report foundation

Audit point 6 adds Reports previews and CSV/JSON exports for site energy, immutable baseline versions and saved savings runs. Shared result contracts retain periods, units, source revisions, model/factor versions, missing coverage and experimental status. Downloads recheck access and preview fingerprints; historical corrections do not rewrite baseline/savings evidence. All six audit implementation gaps are addressed. Methodological/production acceptance and later scheduling/archive/PDF/narrative work remain separate; see the current summary in SPRINT_5_ACCEPTANCE.md.

### Sprint 6 progress — opportunity investigation intake

The first Sprint 6 slice converts a saved Waste & Savings run into an owned investigation with frozen analytical evidence. Opportunities now supports a paged site register, detected/reviewing/rejected states, required review notes, immutable event history, idempotent creation/decisions and transactional audit. Source corrections do not rewrite evidence; archived history and assigned-site permissions are enforced. Analysis remains UNVALIDATED. Approval/actions/implementation, verification, legacy investigation evidence links and AI tooling remain upcoming slices. See SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — ownership, actions and operational approval

Versioned action plans now support owner reassignment, action owners/dates, owner/admin approval, implementation progress and completion evidence. Approval pins the plan; approved scope is fixed, later progress/assignments append revisions, and implemented status requires all actions complete. Permissions, stale work/stage checks, immutable history and atomic audit preserve traceability. Operational approval leaves analytical compatibility and verified savings unchanged. Next: verification records and guarded outcomes. See SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — verification evidence and guarded outcomes

Implemented opportunities now accept immutable verification submissions and revisions with a separate later reporting run, exact baseline/meter lineage, actual implementation date, supporting references and pinned action-plan/report evidence. Owners/admins can reject the outcome; source corrections preserve the submitted history. Verified savings remains blocked in the service and database pending methodology approval, independently of the accepted 0.99 absolute workbook tolerance. Next: operational log/checklist/programme and curated-tip evidence links. See SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — operational logs, programme answers and curated tips

Opportunity investigations now preserve existing operational-log revisions, programme/checklist questions and answer lists, and sourced monthly tips. Supporting records pin site/end-use and optional saved-action evidence, retain legacy provenance, and support immutable amendments with audit and scoped access. Recommendations remain distinct from measured savings. This is the manual evidence-linking foundation; bulk legacy reconciliation and a global tip catalogue are not included. Next: tenant-scoped AI tools, citations and audit foundations. See SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — AI evidence tool boundary

AI Analyst now exposes deterministic saved-baseline and saved-savings evidence previews with server-issued citations, preserved validation/missing-data status, private paged history and immutable transactional interaction audit. Strict tool inputs and fact-selection contracts reject caller-defined scope, SQL, invented values and unknown citations; current site access is checked on retrieval, retries and downloads. Prompt fingerprints and explicit zero provider/token usage are recorded. No model is connected and no AI answer is generated. Next: provider integration and grounded generation, provider/failure audit and live adversarial validation; see SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — provider-backed grounded answer path

Implemented the configurable server-side OpenAI Responses adapter and constrained fact-selection answers, with citation validation, server-owned values/limitations, immutable request/outcome records, provider usage/error metadata, entitlement checks, a daily attempt cap and duplicate-call protection. AI Analyst now exposes generation and private attempt history when configured and entitled. Local API key/model are absent, so live acceptance remains open; mocks cover provider and browser paths. Next: configure the selected model/key and run live adversarial acceptance, then pending-attempt reconciliation and broader analytical tools. See SPRINT_6_ACCEPTANCE.md.

### Sprint 6 progress — opportunity evidence reports; OpenAI deferred

Per user direction, skip OpenAI API configuration/live integration and proceed with independent work. Added current investigation JSON exports and deterministic `saved_opportunity` previews spanning original analysis, actions, supporting records and verification history. Preview citations retain the exact full report and remain downloadable after subsequent changes, subject to current site access and author privacy. Verified savings remains unavailable. Next: review the remaining Sprint 6 acceptance gaps with OpenAI work explicitly deferred.

### Sprint 6 review — remaining independent work

The [25 September audit](SPRINT_6_AUDIT.md) identifies three functional gaps: operational-log selection is limited to the latest 100 current records, savings evidence previews cannot select saved carbon evidence, and valid longer multibyte entries can exceed API request-size limits. A verification run picker is an additional usability follow-up. Next: address audit point 1 with scoped pagination/search and historical revision selection. Methodology approval remains separate; OpenAI configuration, live acceptance and provider-specific follow-ups remain deferred.

### Sprint 5 recheck — portfolio energy and cost

Addressed point 1 of `SPRINT_5_RECHECK.md`: Portfolio now includes scoped monthly/annual energy and net-cost totals, fuel/site filters, coverage and source-reading evidence. Current portfolio/site/meter scope and assigned-site restrictions are enforced in one repeatable-read query; missing data and mixed currencies cannot become misleading totals. Remaining Sprint 5 recheck points are older carbon-run selection, archived-site carbon history and carbon preview/export consistency. Sprint 6 OpenAI work remains deferred.

### Sprint 5 recheck — older carbon calculations

Addressed recheck point 2 with cursor-paged carbon history and exact saved-run lookup. Loaded historical results remain selectable for matching target assessments, preserve their original snapshots after corrections, and retain current tenant/site authorization. The latest-50 list endpoint remains compatible for other consumers. Remaining recheck points: archived-site Carbon UI access and carbon preview/export consistency.

### Sprint 5 recheck — archived carbon history

Addressed recheck point 3: Carbon now lists authorized archived sites and provides read-only calculation, target-revision and assessment history. A scoped context read replaces the active-only Energy dependency. Site write controls are hidden and existing server guards reject writes; revoked access remains denied. Recheck point 4, carbon preview/export consistency, remains open.

### Sprint 5 recheck — carbon preview/export consistency

Addressed recheck point 4 with stable site/portfolio preview fingerprints and HTTP 409 rejection when export evidence or scope changes. Report authorization, current summary and immutable source retrieval now share a repeatable-read transaction. UI downloads require the preview fingerprint; unchanged repeated downloads remain available. All four Sprint 5 recheck implementation findings are addressed. Methodology approval and production reconciliation remain separate gates; OpenAI work remains deferred.

### Sprint 6 audit follow-up — operational-log discovery

Addressed audit point 1 with scoped cursor pagination, code/operation search, historical revision selection and exact-ID lookup. Selected revisions remain available while navigating, and attachments retain immutable evidence. Next: audit point 2, optional saved carbon evidence in savings previews. OpenAI integration remains deferred; methodology approval remains a separate gate.

### Sprint 6 audit point 2 — saved carbon evidence

Savings previews now accept explicitly selected saved carbon evidence with existing scope and reading-revision compatibility checks. Retry identity, citations and fingerprint-checked source downloads preserve the selection; unavailable carbon stays unavailable. Next: audit point 3, scoped verification run selection. OpenAI integration remains deferred and methodology approval remains separate.

### Sprint 6 audit point 3 — verification run picker

Replaced manual verification run IDs with scoped, paged reporting and optional carbon selectors. Choices expose the meter, exact baseline, period and status, account for implementation date, and explain ineligible or missing evidence. Submission checks and archived read-only behavior remain enforced. Next: audit point 4, valid payload size limits. OpenAI remains deferred; methodology approval is separate.

### Sprint 6 audit point 4 — request byte budgets

Opportunity creation, review, action plans, verification and supporting evidence now have bounded byte caps sized for schema-maximal text including JSON escaping. Existing field validation and streamed overflow rejection remain intact. All four independent Sprint 6 audit items are addressed; methodology approval and deferred OpenAI acceptance are still separate gates. Next: prepare Sprint 7 and identify unresolved commercial-policy decisions.

### Sprint 7 started — assigned plan and usage

Billing now exposes an owner-only overview and API showing the assigned plan, active-site capacity and existing feature entitlements. It explicitly distinguishes assignment from a paid subscription and makes no external billing calls. See SPRINT_7_DESIGN.md and SPRINT_7_ACCEPTANCE.md. Next: settle commercial policy and build subscription-state/entitlement foundations, followed by Stripe test-mode integration. Prices, trial and lifecycle rules remain unapproved; Sprint 6 methodology and deferred OpenAI gates remain separate.

### Sprint 7 — shared assigned-plan policy

Centralized billing inclusion, site/import capacity and AI eligibility under an explicitly versioned local-assignment resolver. Persisted capacity overrides and existing feature grants remain intact; invalid configuration fails closed. Payment state and commercial quotas remain open. Next: settle commercial policy and add durable subscription state and server-owned price mapping before Stripe test-mode checkout. OpenAI execution remains deferred.

### Sprint 7 — server price catalogue foundation

Added a validated test-mode price-to-plan catalogue and offline configuration checker. Exact mappings retain version/content identity and fail closed for unmapped prices. No real prices, checkout, provider verification or subscription mutations are enabled. Next: durable subscription records and provider validation after commercial mappings are available; lifecycle policy and OpenAI deferral remain unchanged.

### Sprint 7 — subscription evidence schema

Added and isolated-tested customer/subscription identity bindings and immutable subscription observation revisions with composite scope and sequential lineage constraints. No application writer, payment integration or access change is enabled. Next: trusted provider validation and audited subscription ingestion; prices and lifecycle decisions remain required for activation.

### Sprint 7 — audited subscription observations

Implemented the owner-authorized internal observation service for pre-bound subscriptions. Current-state reader results are scope/price checked, hashed, revisioned and audited atomically with post-fetch authorization and stale-fetch rejection. Test providers establish the storage contract only; real Stripe transport, price amounts, signed webhooks and commercial policy remain open. No payment or entitlement activation occurred.

### Sprint 7 — Stripe read-only transport

Implemented test-mode account/subscription/price retrieval for the observation reader contract, with identity/shape checks and bounded transport. Mocked HTTP acceptance passes; real provider credentials and activation are not configured. Next: signed event receipt handling and durable reconciliation. Approved commercial terms remain required before checkout/access activation.

### Sprint 7 — signed webhook receipts

Added a disabled-by-default test webhook inbox with raw signature verification, scoped event deduplication and immutable durable receipts. No tenant is inferred from event metadata and no access is changed. Next: durable processing/retry outcomes and binding-based current-state reconciliation; commercial policy/checkout remains pending.

### Sprint 7 — durable reconciliation worker

Added owner-operated scoped reconciliation of bound test receipts, with durable claims/retries, current-state observation, crash recovery and atomic revision auditing. Unbound/unsupported receipts remain in the inbox. Real Stripe acceptance, trusted customer/subscription binding creation, commercial policy and checkout remain open; no system-principal scheduler or effective subscription access is active.

### Sprint 7 — reviewed subscription binding

Added operator-only reviewed manifest intake and atomic provider-verified customer/subscription binding with initial evidence and audit. Reassignment/conflicting bindings are rejected. Real Stripe test-account acceptance now requires server-side test configuration and reviewed workspace/customer/subscription IDs; no credentials are configured. Checkout and commercial access activation remain pending approved terms.

### Sprint 7 — executable test-account readiness

Added a local configuration gate and concrete real-provider acceptance runbook. Current readiness is BLOCKED: test credentials/account/webhook secret/catalogue are absent. No real-account acceptance can be claimed until configuration and reviewed test identities are supplied. Next external step is supplying those prerequisites; payment activation remains disabled.

### Sprint 7 — retained report foundation

Added explicit preview retention and immutable JSON/CSV retrieval for energy, baseline and savings reports, with scoped history, exact fingerprint matching, retry safety and atomic auditing. This progresses independently of blocked real Stripe acceptance. Next report increment: define scheduled-report execution and delivery contracts, including recipient authorization, cadence/time zone and retry handling. No scheduling or email is enabled by this archive slice.

### Sprint 7 — scheduled-report access preflight

Added internal current-plan, owner, archive and recipient eligibility checks. Revoked membership, missing site assignments, cross-tenant references, archived sites and changed fingerprints block eligibility. Existing retained-report reads and password login are preserved. This is read-only and does not activate scheduling or email. Next: durable schedule revisions and occurrence/delivery jobs, followed by approved cadence, recipient/channel and retry policy integration.

### Sprint 7 — durable schedule drafts and occurrence jobs

Added immutable schedule revisions and held occurrence jobs with tenant-bound references, current eligibility checks, idempotent requests, optimistic revision checks and atomic cancellation of superseded jobs. Cancellation remains possible for a current creator after loss of writer role or plan eligibility. Migration is prepared and validated in temporary databases. Next: management/read APIs and execution/attempt lifecycle; recurrence and email delivery remain disabled pending policy and transport work.

### Sprint 7 — schedule management APIs

Connected authenticated draft creation/edit/cancellation and held-job preparation. Added creator-private list/detail/history/job reads with bounded scoped cursors, current membership checks and no-store responses. Delivery remains DISABLED; no send endpoint or transport is active. Next: schedule management UI and execution/attempt lifecycle, followed by approved recurring delivery policy.

### Sprint 7 — report schedule management UI

Added Reports-panel controls for retained-snapshot drafts, authorized recipient selection, editing/cancellation, paginated history/jobs and explicit UTC held occurrences. Errors and revision conflicts retain user input with a reload option. Next: execution claims, attempt records and recovery before connecting approved recurring delivery. Automatic scheduling and email remain disabled.

### Sprint 7 — durable delivery-readiness worker

Added per-job claimed readiness checks with leases, sequential immutable outcomes, idempotent requests, interruption recovery and stale-token protection. Completion rechecks current schedule and access, retaining READY_NO_SEND/BLOCKED/INTERRUPTED without sending or changing HELD jobs to delivered. Next: operator check-history visibility and approved activation/transport/retry contracts. Migration is prepared; no automatic worker or email is enabled.

### Sprint 7 — readiness-check history visibility

Added creator-scoped, paginated check-history reads and schedule-panel visibility for ready-without-send, blocked, interrupted and expired-but-unrecovered checks. Claim tokens and idempotency keys stay server-side. Next: controlled readiness execution/recovery and approved cadence, recipient and transport rules before enabling automatic delivery.

### Sprint 7 — controlled readiness execution and recovery

Connected manual per-job readiness checks and expired-claim recovery through a strict authenticated endpoint and panel controls. HTTP responses contain no claim tokens; request-key retries do not duplicate checks. Future, busy and cancelled jobs produce explicit non-delivery outcomes. Next: settle recurring delivery policy and implement the provider submission/reconciliation contract. Automatic scheduling and email remain disabled.

### Sprint 7 — manual retained-report links

User decision: keep delivery manual. Added protected snapshot pages with exact login return paths, current-access checks, separate view audits and retained JSON/CSV downloads. Automatic recurrence and report email activation are deferred. Next: manual-flow acceptance and remaining Sprint 7 gaps within that constraint.

### Sprint 7 — local database activation

Applied the six pending billing/report migrations (`202609260001` through `202609260006`) to the existing local development database. All 38 migrations are complete; all 10 new tables are readable, and row counts in all 57 pre-existing application tables are unchanged. No reset or seed was run. Manual-flow acceptance is recorded above; automatic delivery remains deferred. Production migrations/deployment and the real Stripe/commercial acceptance gates remain outstanding.

### Sprint 7 — combined regression and gate review

Passed the full 389-test unit suite, five Sprint 7 database suites, three combined billing/report browser workflows, full lint/format checks and the production build. Added a current-scope table to SPRINT_7_DESIGN.md to distinguish completed foundations from historical increment notes. No new application defect was found in this run. The next commercial implementation step requires approved offers/lifecycle policy and Stripe test configuration; manual report delivery remains the selected scope. These checks do not mark all of Sprint 7 accepted or authorize production deployment.

### Sprint 8 started — isolated restore tooling

User deferred billing. Added an isolated PostgreSQL backup restore rehearsal script and operational acceptance record in SPRINT_8_ACCEPTANCE.md. Script-control tests and shell syntax pass; an actual restore requires authorized Docker access and a trusted dump and remains unverified. Billing, live AI and automatic report delivery remain deferred. Next: execute the restore exercise when its environment is available; observability and other independent operational work can proceed meanwhile. No production cutover is authorized or accepted.

### Sprint 8 — bounded database health and transition logs

Added a two-second database health deadline, shared outstanding probes and sanitized outage/recovery events while preserving the public no-store 200/503 contract. Six focused tests, TypeScript and lint/format checks passed. This is connectivity monitoring, not schema or background-worker readiness. Next independent increment: weather-worker progress visibility and operational diagnosis; backup restoration and real-source reconciliation remain open gates.

### Sprint 8 — weather-worker progress visibility

Added private atomic progress snapshots, sanitized state-transition logs and a container health check that distinguishes idle progress from stalled, failed or stopped workers. Unit/CLI coverage and an isolated actual-worker lifecycle check cover the monitoring contract. Deployment now waits for worker health when using the new Compose definition. No automatic recovery, provider activation or production deployment is included. Next: operational alerting/runbook coverage; actual backup restoration and real-source reconciliation remain open.

### Sprint 8 — operator diagnostics and runbook

Added a bounded read-only deployment check, explicit HEALTHY/ATTENTION/UNKNOWN outcomes and issue-specific operator guidance. Seven diagnostic tests and four restore-control tests pass and are included in CI. The local Docker-access failure is reported as UNKNOWN without exposing error details. Notification routing and production validation remain open; no recurring monitor or remediation was enabled. Actual restore and real-source reconciliation remain unaccepted gates.

### Sprint 8 — complete backup publication and integrity preflight

Replaced direct final-name dumps with atomic private backup bundles and added checksums before restore rehearsals. Failed/empty/invalid backups stop migration and do not overwrite prior backups. Five backup, six restore-control and seven diagnostics tests pass; backup tests now run in CI. Host installation and an actual Docker restore remain pending, and no production data was accessed. Restore verification, off-instance storage and retention remain separate acceptance requirements.

### Sprint 8 — administrative audit history

Added workspace-scoped audit pagination and Older/Latest activity navigation beyond the previous newest-100 limit. The original API response remains compatible; a separate history endpoint returns bounded pages with scoped cursors and current-role checks. Database and browser acceptance passed, including tied timestamps, intervening inserts, tenant isolation, revocation and mobile layout. No data retention policy or support impersonation was introduced. Operational rollout, actual restoration and real-source reconciliation remain open.

### Sprint 8 — incident activity lookup

Added exact action-code and request-ID filters to audit history, preserving filters through pagination and resetting cursors for new searches. Scoped cursor checks reject events outside the selected result set. Unit, database and browser checks passed, including empty states, clearing filters and cross-workspace isolation. The operator runbook now describes correlation lookup. No broader administrative permissions, data retention changes or production deployment are included.

### Sprint 8 — audited activity-page exports

Added explicit CSV/JSON downloads for up to 100 matching audit events, including filters and pagination evidence. Each authorized export records its page boundaries atomically; audit failure blocks the download. CSV neutralizes formula-like fields and JSON retains original values. Unit, database and browser checks passed. This is bounded incident evidence export, not bulk workspace extraction or a retention-policy change. Production rollout and the existing recovery/reconciliation gates remain open.

### Sprint 8 — cutover and rollback runbook

Added the missing cutover procedure with evidence gates, rehearsal, writer freeze, final reconciliation, traffic release and distinct application/database recovery decisions. Production execution remains blocked on real sources, restore evidence and operational decisions. Review identified the next independent implementation gap: a restart-safe write-freeze mechanism, because routine deployment restarts application and worker services. No production action or acceptance is implied by preparing the runbook.

### Sprint 8 — restart-safe application write freeze

Added runtime read-only database connections, maintenance guards and notices, read-only existing-session authentication, paused worker health and frozen-deployment rollback protection. Unit, isolated database/worker and frozen/normal browser checks passed. The operator procedure requires a compatible release, complete writer drain and container recreation; no local or production freeze was enabled. Next operational gates remain actual restore evidence, host rollout and real-source reconciliation. Billing, live AI and automatic delivery remain deferred.

### Sprint 8 — backup freshness and capacity checks

Added a read-only backup check with explicit age/capacity thresholds, sanitized evidence and actionable stale/missing/incomplete/invalid/low-space outcomes. Six tests pass and run in CI. HEALTHY does not certify archive integrity or restoration; no retention policy, schedule, deletion or production rollout is enabled. Actual restore evidence, host rollout and real-source reconciliation remain open.

### Sprint 8 — real restore smoke test CI gate

Added a separate PostgreSQL container smoke test for successful synthetic archive restoration, exact table counts and rejection of unresolved migration history. Deployment now waits for this CI job. Three local orchestration tests pass; actual Docker execution is pending because local socket access is denied. This does not replace the outstanding production-backup restoration, application reconciliation and host rollout evidence.

### Sprint 8 — import-retention inventory

Added an Owner/Admin-only read API for aggregate workbook-import counts and dates across seven categories, with explicit cutoff validation, tenant-scoped snapshot reads and no imported payload exposure. Unit and database checks passed, including revocation and operation during a write freeze. This supplies evidence for retention decisions; it enables no deletion or scheduled cleanup. Approved retention/hold policies and a broader data export/deletion workflow remain open.

### Sprint 8 — import-retention workspace page

Added an Owner/Admin page linked from Settings and Data with explicit UTC cutoff selection, per-category cards, inconsistent-record notices, empty states and query validation. URL-based filtering supports refresh and clearing, and the page uses the existing authorized inventory service without mutation. No retention policy, deletion or cleanup schedule is activated.

### Sprint 8 — audited retention inventory downloads

Added explicit JSON evidence downloads with current access checks, aggregate fingerprint matching and atomic audit receipts. Changed summaries require a fresh review; maintenance pauses downloads while inventory reads remain usable. Query and database acceptance passed, including audit-failure rollback. No retention/deletion policy or production deployment is included.

### Sprint 8 — inconsistent import record investigation

Added a metadata-only drill-down from inconsistent inventory counts, with 50-record pages, scoped cursor validation and Older/Latest navigation. Owner/Admin access is rechecked for each page; uploaded content remains excluded. This supports investigation without repairs or deletion and preserves normal read-only maintenance behavior.

### Sprint 8 — original source intake manifest

Added a read-only migration intake CLI that records full original export/schema hashes and sizes with explicit source, extraction time, scope and target metadata. Publication is private and exclusive; originals remain untouched and approval flags remain false. Six synthetic tests pass and are wired into CI. Real source files, reviewed mappings and independent reconciliation totals remain required.

### Sprint 8 — preserved-source verification

Added read-only verification of original export/schema files against their intake manifest, with exact hash/size comparisons, bounded contract validation, sanitized per-file outcomes and manifest-byte binding. All 11 intake/verification tests pass and are included in CI. Matching files do not establish source authenticity or reconciliation approval; real-source intake, mappings and independent totals remain open.
