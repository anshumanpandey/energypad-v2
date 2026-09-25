# Sprint 5 completeness audit — 2026-09-24

Status: all six numbered implementation gaps addressed as of 2026-09-24. Statistical-method approval and broader production acceptance remain separate gates; see the current summary in `SPRINT_5_ACCEPTANCE.md`. Original findings are retained below for traceability.

Scope: Sprint 5 in `V2_IMPLEMENTATION_PLAN.md`, FP15/24/25/26/28/29 in `FEATURE_PARITY.md`, the retained analytics in `LEGACY_FEATURE_INVENTORY.md`, and the master product specification. Numbering below is stable for follow-up fixes.

Delivered foundations include versioned emission factors, immutable meter carbon runs, coverage-aware site and portfolio summaries, annual meter carbon targets and saved assessments, named-sheet factor/target imports, and carbon CSV/JSON exports with source evidence. The follow-up resolutions below add the remaining audited analytics/reporting foundations.

## 1. Overview still shows foundation content — addressed 2026-09-24

**Resolution:** The new Overview provides scoped site/year KPIs, explicit carbon filters, monthly energy/cost coverage, source-reading and saved-run evidence, and an unavailable verified-savings state linked to unvalidated analysis. See `SPRINT_5_ACCEPTANCE.md`.

Original finding: `apps/web/src/app/org/[organisationId]/[section]/page.tsx` renders workspace/site/team/plan information and onboarding at the Overview branch (line 147), and still says analysis and reporting follow in later stages. It does not provide the planned analytical overview.

Completion: scoped energy, cost, carbon and savings summaries with explicit periods, coverage and drill-down evidence. Unavailable or unapproved results must remain distinct from zero; corrections must not silently rewrite historical evidence.

## 2. Waste & Savings business surface is missing — addressed 2026-09-24

**Resolution:** A dedicated saved-run page now shows pre/post-NRA variance, significance, financial/carbon estimates and immutable evidence. Explicit missing-data and unvalidated states are retained; see `SPRINT_5_ACCEPTANCE.md`. Opportunity conversion remains Sprint 6 scope.

Original finding: FP24 retains Energy Waste with financial/carbon impact and significance. Advanced Analysis already exposes saved expected/actual, pre/post-NRA variance and significance, but the section router and navigation have no Waste & Savings destination or business summary tying those results to cost/carbon impacts.

Completion: a readable saved-run-based workflow showing adjusted expected versus actual, saving/waste signs, units, significance and pre/post-NRA values, with traceable cost/factor assumptions. Preserve the analysis approval status. Opportunity conversion belongs to the shared Sprint 5–6 scope and need not introduce the entire Sprint 6 opportunity workflow here.

## 3. Site Performance / Benchmarking is missing — addressed 2026-09-24

**Resolution:** Site Performance now supports comparable-period/fuel rankings, cost currency restrictions, deterministic sorting, visible missing-data exclusions, monthly evidence and annual carbon target comparisons. Site-manager scope is enforced. Target-model expansion remains point 4; see `SPRINT_5_ACCEPTANCE.md`.

Original finding: FP25 allocates the replacement for Utility League to Sprint 5. Neither the section router nor workspace navigation exposes it. The current Portfolio page manages portfolios and displays carbon coverage; it is not the retained consumption/cost/target comparison and ranking workflow.

Completion: comparable site/period/unit filters, consumption/cost/target comparisons and deterministic sorting. Explicitly handle incomplete periods, missing targets, incomparable currencies/units and assigned-site access. Test rankings and missing-data treatment.

## 4. Target and monitoring parity is partial — addressed 2026-09-24

**Resolution:** A separate monthly ledger now distinguishes consumption/carbon targets from utility-monitoring plans, including end-use links, sourced unit conversion, all-month expansion, immutable corrections, named-sheet import previews/commits/retries and monthly energy target comparisons. Existing annual carbon targets remain separate. See `SPRINT_5_ACCEPTANCE.md`.

Original finding: `apps/web/src/domain/carbon-targets.ts` defines annual meter-level absolute kgCO2e limits. The delivered target import uses that same model. FP28 requires distinct treatment of the two legacy mechanisms: dated consumption/carbon targets and energy/carbon monitoring records, including monitoring end-use links. See legacy `20221212195034_consumption_emission_target.ts`, `20260712224525_TargetConsimptionTargetCarbon.ts` and `20230424183822_utility_monitoring.ts` migrations.

Completion: map the retained dated energy/carbon target and monitoring semantics to explicit V2 models and workflows, including monthly/all-month import behavior where retained. Keep targets, baseline predictions and actuals separate. Extend FP15 previews, commits, corrections and retry tests to the newly supported records. Annual carbon assessments alone do not close this parity item; full verification remains shared with Sprint 6.

## 5. Carbon and portfolio trend analytics — addressed 2026-09-24

**Resolution:** Carbon trends now compares two years with monthly charts, annual changes, site comparisons, coverage and immutable source evidence for an authorized site or portfolio. Both years use the same current active site/meter scope and explicit geography/basis. Missing or stale months remain gaps. See `SPRINT_5_ACCEPTANCE.md`.

Original finding: `carbon-summary.tsx` and `portfolio-carbon.tsx` provide one-year scope checks and tables. Saved meter runs contain monthly evidence, but there is no consolidated site/portfolio trend view. The specification's CarbonFootprint redesign explicitly retains portfolio/site trends.

Completion: monthly/site/portfolio trend comparisons with consistent geography, reporting basis and meter scope, visible missing/stale coverage, and links to immutable reading/factor/run evidence. Displaying individual run rows is useful evidence but does not complete the comparative dashboard.

## 6. Reporting foundation covers carbon only — addressed 2026-09-24

**Resolution:** Reports now includes energy, saved baseline and saved savings previews with versioned contracts, CSV/JSON exports, periods, units and complete source/model/factor evidence. Preview fingerprints prevent silently exporting changed inputs; downloads recheck authorization. Experimental analysis remains UNVALIDATED. Scheduling, archives, PDF and narrative generation remain later work. See `SPRINT_5_ACCEPTANCE.md`.

Original finding: The Reports branch (page.tsx line 48), `src/server/carbon.ts` report method and `src/domain/carbon-report.ts` cover site/portfolio carbon exports. FP29 also retains energy, savings and baseline reports; these have no corresponding report contracts or destinations yet.

Completion for the foundation: define and implement the retained report families against saved evidence, with period, units, inputs, model/algorithm/factor versions and consistent screen/export results. This is a remaining cross-sprint item, not a claim that scheduled reports, AI narratives, PDF or every final presentation format must ship in Sprint 5. Those later features are excluded from this audit's immediate blockers.

## Acceptance and documentation follow-up

The user's absolute tolerance of 0.99 and confirmation that all three workbooks were fully recalculated are already recorded; this audit does not reopen either decision. The latest recorded comparison passes 305 numeric checks and 36 significance decisions. The application still labels Advanced Analysis unvalidated and the acceptance documents distinguish numerical comparison from methodological/edge-case approval. Resolve that separate gate before labeling dependent savings analytics approved or verified.

Several progress documents retain historical “next” or “not started” statements above newer delivered sections. Consolidate a current acceptance summary when closing the sprint so those historical statements are not mistaken for present status.
