# EnergiePad V2 compatibility decisions

Sprint 0, 17 September 2026. Status: proposed decisions, awaiting review. Findings below come from static source inspection and read-only workbook analysis. They are not production exploit tests. No fixtures or application code were changed.

Decision precedence: approved V2 specification → approved Excel methodology/results → legacy implementation → legacy tests/history. Where formulas, cached outputs or labels disagree, record the discrepancy and obtain an explicit decision. A suggested resolution below is not approval.

## Calculation and workbook decisions

| ID | Evidence and conflict | Proposed treatment | Required acceptance test / gate |
| --- | --- | --- | --- |
| CD01 | waste.service.ts:199 compares signed waste with threshold; multi-driver paths use abs(). V2 requires absolute variance. | Positive = saving; negative = waste; significance compares absolute value ≥ 2×SE. | Equal-magnitude positive/negative, below/equal/above threshold; Sprint 4. |
| CD02 | SE divisors 22/20/9 in waste.service.ts:181/414/626 assume fixed samples. Available NRA workbook A44 uses SSres/8 for N=12 and 3 drivers. | Derive degrees of freedom N−k−1 from matched baseline rows. | Fixture N=12 gives df=8; different N and insufficient observations; Sprint 4. |
| CD03 | linest3Variable conditionally adds daylight column only if value is truthy (line 22). | Zero is valid; missing is a quality error. Select columns by model definition, consistently for all rows. | Zero vs missing driver, matrix rank and shape; Sprint 4. |
| CD04 | NRA output uses nraWaste.find(i => i.date), line 529; reporting consumption lookups also match only date. | Join site, fuel/meter, end-use where applicable and period; never first truthy date. | Multiple months/sites/fuels and shuffled input ordering; Sprint 4. |
| CD05 | energyWaste and reports controllers pass multi_nrv_hdd arrays for HDD/CDD/hours/daylight (around lines 535 and 729); first site ID is substituted. | Production analysis must use persisted tenant/site observations with readiness checks. | Distinct sites/drivers yield distinct expected values; sample data cannot enter live analysis; Sprint 3–4. |
| CD06 | greenDays.service.ts getHdds/getHdds2 use fixed postcode 02632 with US/GB; older path uses base temperature 60 C. | Provider adapter must accept validated site location, units and versioned methodology. | Assert outbound request location/base, persist response provenance, retry failures; Sprint 3. |
| CD07 | dashboard.service.ts wasteCost computes consumption / consumptionCost × waste and absolute value. | Resolve currency-per-energy basis, gross/net VAT and sign/display rules. Proposed monetary amount uses cost / consumption × signed variance, with magnitude shown separately. | Dimensional example: 100 kWh costing 20 currency units and 10 kWh saving gives 2 currency units; zero denominators; Sprint 5. |
| CD08 | Carbon helper selects factors by year/site/fuel, optionally ignores fuel; rounds factor×quantity before conversion. energyWaste response also overwrites carbonEmission with converted waste without multiplying factor. | Select immutable effective-dated factor matching geography/fuel/unit; separate actual carbon and avoided/wasted carbon. | Mixed fuels, mid-year factor changes, conversion precision and output semantics; Sprint 5. |
| CD09 | produced mock consumption uses zero for missing periods. Some code excludes produced values, other aggregates consume filled series. | Preserve quality/missing status; no silent actual-zero substitution or fabricated baseline observations. | Missing month vs measured zero and insufficient baseline; Sprint 3–4. |
| CD10 | Old dashboard calculator and V2-named waste calculator coexist; end-use scenarios differ; tests assert rounded exact numbers. | One approved engine with explicit model selection. Keep historical characterization separate from golden compatibility. | All end-use scenarios have an approved mapping; absolute/relative numeric tolerance at raw precision; Sprint 4. |
| CD11 | Corrected 22 September: direct XML inspection of the unchanged recorded NRA source shows B38:M38 all use AVERAGE(B9:M9). The earlier shifting-range claim was incorrect. | Withdraw the claimed formula/cache conflict; preserve the unchanged source. Review native recalculation, expected results and methodology before approving it. | Reproducible raw formula/cache extraction in scripts/extract_nra_evidence.py; native recalculation and golden approval remain open. |
| CD12 | Workbook H49:H52 uses strict p<0.01 and p<0.05; V2 text uses ≤0.01 and ≤0.05. | Follow V2 inclusive boundaries in versioned labels, subject to explicit decision. Numeric p-values remain unchanged. | Exactly 0.01/0.05 and adjacent values; Sprint 4. |
| CD13 | Workbook B90:M95 applies significance to final post-NRA variance against unchanged 2×baseline SE. Legacy multi-NRA path computes significant from pre-NRA waste. | Follow approved workbook methodology: post-NRA absolute variance and baseline SE threshold; expose pre/post values. | NRA changes classification; matched month gets correct final variance; Sprint 4. |
| CD14 | R² labels differ across references; workbook K41 thresholds are 0.90/0.80/0.75. | Version configurable thresholds and labels separately from numerical engine. | Boundary labels and policy versions; do not silently recompute old report wording. |
| CD15 | Numerical edge policies absent: constant series, collinearity, small N, negative prediction, zero baseline hours/population, zero variance with zero threshold. | Return explicit unsupported/quality states where undefined; agree extrapolation and clipping policy. Do not silently clamp or invent denominators. | Edge-case fixtures before accepting Sprint 4. |

## Available NRA workbook evidence

File: `/home/leonardo/Downloads/Multi Routine Adjustment Plus NRA V2.xlsx`.

SHA-256: `427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed`.

Sheet `Regression Analysis`, used extent A1:M98, 347 formulas with cached results. Baseline inputs B6:M9; coefficients A29:D29; fitted/residual arrays B35:M38; summary A41/D41/G41/A44; coefficient tests B49:H52; reporting inputs B58:M61; hours B71:M72; population B76:M77; NRA B81:M84; significance B90:M96.

Independent NumPy least-squares calculation from baseline inputs yields:

| Metric | Independently calculated | Workbook cached value / interpretation |
| --- | --- | --- |
| Intercept | 43.84850069279235 | A29 agrees. |
| HDD coefficient | 0.2756006378918187 | Coefficient ordering mapped to B29. |
| CDD coefficient | 0.31615731179141154 | Coefficient ordering mapped to C29. |
| Daylight coefficient | −0.07677359197580824 | Coefficient ordering mapped to D29. |
| SSres | 61.319303199044896 | Used for the independent SE/R² derivation. |
| Fixed-mean SStot | 105.66666666666666 | Standard definition in the specification. |
| Fixed-mean R² | 0.4196911369175561 | G41 cached 0.41969113691755555. |
| Regression SE, df=8 | 2.7685579097935826 | A44 cached 2.768557909793584. |
| Direct stored-formula check, 22 September | All twelve B38:M38 formulas use B9:M9. | Earlier shifting-range values were based on an incorrect interpretation and are withdrawn. |

This is independent formula analysis, not an Excel/native-engine recalculation or a completed V2 golden test. No file was resaved. P-values were inspected as TDIST(ABS(t),df,2) formulas, not independently numerically validated in this pass. Confirm all ranges and approved expected values when the full fixture set is available.

## Security and import decisions

| ID | Evidence and conflict | Required V2 treatment | Acceptance test |
| --- | --- | --- | --- |
| CD16 | Root business.route.ts importBusiness omits AuthMiddleware; BusinessExcelClient accepts and hashes a workbook password. | Separate authenticated import from secure onboarding; reject credentials or explicitly discard before storage/logging. Recommended default: reject credential columns and offer sanitized remapping. | Unauthorized import blocked; password values absent from DB, logs, error files and staging artifacts. |
| CD17 | Sites controller reads/updates/deletes by ID; sites service where clauses do not require businessId. | Mandatory organisation scope and permission on reads, writes and related object references. | Another tenant's ID fails on details, update, delete and conversion-unit writes. |
| CD18 | Utility writes test site existence without ownership; imports resolve all sites/by name; business tips accepts businessId from query. Some business methods do check ownership. | Central service policy covering every route, import, job, file URL and AI tool; do not infer authorization from JWT presence. | Mixed-tenant bulk request rejects atomically; guessed site/tip/target IDs reveal nothing. |
| CD19 | ConversionUnitService.getTargetConsumption has no business parameter; callers can omit site scope. | Require authorised site scope even for portfolio/all-sites queries. | Portfolio targets contain only caller's sites. |
| CD20 | Nested users/business/utilities CRUD has no route/global auth in inspected source. | Reference data contracts only; do not port those access patterns. | All equivalent new routes have session, role and tenant checks. |
| CD21 | Business workbook headers place password at O, town I, postcode J, country L; current parser expects password I, town K, postcode L, country name M. Sites layout likewise differs. | Map semantic headers explicitly, distinguish IDs from names and validate all rows. Do not use filename as schema version. | business_example_v3.xlsx maps both sheets; credential rejection; actionable missing code/country decisions. |
| CD22 | Business import controller inserts data[0] only although workbook contains two business rows. | Preview organisation grouping; restrict tenant import to selected org, and reserve multi-org migration for platform administration. | No silently dropped business row or cross-org site assignment. |
| CD23 | Utility import deletes site/fuel/year data before inserting a batch; some invalid business rows are skipped. | Explicit append/correction semantics, dry-run diff, transactional commit and stable idempotency key. | Partial-year correction preserves other months; repeated batch unchanged; rejected rows downloadable. |
| CD24 | Log parser nests a column loop around rows 2–13 and resolves usedIn against fuel sources. | Replace with one row pass and explicit end-use lookup. | More than 12 rows import once each; fuel and end-use IDs cannot be confused. |
| CD25 | Site names/codes globally constrained in migrations; V2 owns sites per org. | Scope external references/code uniqueness to organisation and source system. | Same code in two orgs permitted; duplicate within one org detected. |
| CD26 | 202503 migration removes Sites.population/workinghours while API schema/details still reference them. | Production schema inventory is mandatory; derive period history from available columns, never presume stale schema is truth. | Migration handles before/after versions with reconciliation and no fabricated historical dates. |
| CD27 | localStorage token-presence guard and mixed public/private UI routes; no six-role model found. | Replace with modern auth adapter and server RBAC; site assignments explicit. | Viewer writes fail, assigned-site manager scope enforced, platform admin audited. |
| CD28 | BusinessTenant denotes occupant counts; Businesses conflates identity and organisation. | Split User/Organisation/Membership and map occupants only to drivers. | Counts do not create users; shared emails/duplicate identities resolved explicitly. |

## Product-owner review before Sprint 1

1. Confirm which root/nested revision and database represent production; obtain a sanitized schema export and migration-history list. Working-tree changes are included in this discovery, not assumed deployed.
2. Approve the parity dispositions, especially marketing/placeholders, floors, tariffs, programmes/reviews and legacy end-use models outside the three specified regressions.
3. Confirm organisation membership and assigned-site rules, platform-admin boundaries, invitation ownership and multi-organisation user behaviour. The V2 six-role list is the starting point.
4. Select Auth.js or Clerk behind an adapter and approve the new-app layout alongside preserved legacy source. No provider account or deployment was created.
5. Approve credential-column handling and whether ordinary imports are single-organisation only; recommendation is reject credential columns and prohibit customer multi-org imports.

Before Sprint 4: supply the missing Single Routine Adjustment V2.xlsx and Multi Routine Adjustment V2.xlsx; review and approve NRA expected results and native recalculation evidence, numerical tolerances and calculation policies CD01–15. Formula correctness must not be traded for silent compatibility with a known defect.

Later decisions: weather coverage/provider and base temperatures (Sprint 3); cost/VAT, currency aggregation and waste-rate denominator (Sprint 5); prices/trials/quotas/downgrade handling and the overlapping 100-site plan boundary (Sprint 7); retention, recovery objectives and cutover ownership (Sprint 8).

## Sprint 0 exit status

Repository inventory, proposed feature dispositions, source-field mapping and compatibility register are delivered. Owner review is pending. Production parity cannot be certified from this snapshot; golden compatibility cannot pass with two fixtures missing and unapproved expected results, recalculation evidence and numerical policies. These are explicit acceptance dependencies, not completed checks.

## CD11 correction evidence — 22 September 2026

Read-only extraction from the same recorded SHA-256 found literal formulas `(B9-AVERAGE(B9:M9))^2` through `(M9-AVERAGE(B9:M9))^2`, with no shared-formula attributes. Decimal arithmetic over B9:M9 gives SStot 105.666666666666666… versus cached D41 105.66666666666666 (difference about 6.67e-15). Summing cached B37:M37 squared residuals and using that SStot gives R² 0.419691136917555608… versus cached G41 0.41969113691755555 (difference about 5.89e-17). This is targeted formula/cache evidence, not an independent full regression or native recalculation. See NRA_FIXTURE_REVIEW.md.
