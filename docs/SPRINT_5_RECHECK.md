# Sprint 5 recheck — 25 September 2026

The original six findings in `SPRINT_5_AUDIT.md` have implemented resolutions. This second source review identifies additional follow-ups against FP27/29 and historical-evidence usability. The numbers below refer to this recheck, not the original resolved audit. No application changes or full test reruns were made.

## 1. Portfolio energy and cost aggregation — addressed

Resolution: Portfolio now includes annual/monthly energy and net-cost totals with year, fuel and site filters, per-site totals and reading-revision/conversion evidence. The scoped read uses a repeatable-read transaction and current portfolio membership, active sites/meters and current reading revisions. Assigned-site results are explicitly partial. Complete energy coverage is required; empty sites and sites without meters for the selected fuel withhold totals. Costs additionally require complete amounts in one currency across included sites and months. Registered-meter overlap remains disclosed. See the acceptance record for validation.

Original finding:

FP27 in `FEATURE_PARITY.md` retains portfolio analytics across sites, fuels and months, with totals reconciling to underlying results. The Portfolio branch in `apps/web/src/app/org/[organisationId]/[section]/page.tsx:375` renders portfolio management and `PortfolioCarbon` only. Carbon trends supports portfolio comparisons, but there is no corresponding portfolio consumption/cost summary. `CarbonService.benchmark` compares individual sites; it neither filters by portfolio nor returns portfolio energy/cost totals. Site Overview and site energy reports do not close this aggregate requirement.

Add portfolio monthly/yearly consumption and net-cost summaries with site/fuel filters, authorized active membership, explicit coverage and source-reading evidence. Missing months must not become zero; mixed currencies must not produce a combined cost. Disclose registered-meter overlap consistently. Test reconciliation to included site readings, assigned-site restrictions, corrections, empty/incomplete sites, moved sites and currency boundaries. This is the clearest remaining Sprint 5 scope gap and recommended first fix.

## 2. Older carbon runs — addressed

Resolution: Carbon now loads cursor-paged history and supports exact saved-run lookup. Additional pages and individually opened runs merge into the assessment choices without discarding the current selection or previously loaded records. Exact lookup expands the original calculation's evidence. Access checks apply to every page, cursor and run ID; old results are never recalculated. The legacy latest-50 list API remains compatible for existing consumers, while this workflow uses the new paged endpoint.

Original finding:

`apps/web/src/server/carbon.ts:42` returns the latest 50 site runs without a cursor or an exact-run read endpoint. `carbon-workspace.tsx` uses this limited list, and `carbon-targets.tsx:256` offers only matching runs from that same list for assessment. After 50 newer calculations, an older valid historical run disappears from selection. The assessment service accepts its known ID, but the user cannot find/select it in the form; calculating again can use corrected inputs and is not equivalent to selecting the historical evidence.

Add scoped pagination/filtering or exact-ID retrieval, and use it in history and assessment selection. Test more than 50 runs, an older eligible run after factor/reading corrections, inaccessible run IDs and retry behavior. This limitation was disclosed in the original slice, but remains a functional historical-evidence follow-up.

## 3. Archived-site carbon history — addressed

Resolution: the Carbon selector now includes authorized archived sites with an explicit archived label. A scoped carbon context endpoint supplies meter labels and current archive status without depending on the active-only Energy API. Archived mode retains paged/exact-ID calculation browsing, target revisions and assessments, while hiding calculation/import/target write controls and the current-summary export controls. Existing server-side active-site guards continue to reject writes. Membership and current site assignments still govern all reads; archiving does not restore removed assignments.

Original finding:

The Carbon page passes `foundation.getWorkspace`'s active-only sites to `CarbonWorkspace` (`page.tsx:141`). `FoundationService.listSites` filters `archivedAt: null` (`foundation.ts:137`). Carbon run/target service reads support authorized archived sites, but the page cannot select them. Archiving therefore removes UI access to their retained calculations, target revisions and assessments. The site carbon report also calls the active-only `getSite`, so it is not an archived-history workaround.

Provide an authorized archived-site history mode with read-only runs, target revisions and assessments. Keep creation, correction, import and assessment writes disabled and rejected server-side. Test retained evidence after archive, current membership/site-assignment checks and no write regression. This concerns historical records, not including archived sites in current active-portfolio totals.

## 4. Carbon preview/export consistency — addressed

Resolution: site and portfolio carbon summaries now return a stable content fingerprint. Download controls send it, and the report service rejects changed evidence/scope with HTTP 409 and an instruction to refresh and review the summary. Check timestamps are excluded; saved-run identities/times, current reading/factor identities, coverage, values and site/portfolio scope remain significant. Authorization, summary computation and immutable report evidence retrieval share a repeatable-read transaction. Direct API exports without a fingerprint remain current-state exports for compatibility; UI downloads always require the displayed preview fingerprint.

Original finding:

`apps/web/src/components/carbon-report-download.tsx:14` sends only filters and format. `CarbonService.report` recalculates current coverage, and the carbon route has no expected-content fingerprint check. If inputs or portfolio membership change after a displayed summary, the downloaded totals/scope may differ without a conflict or a refreshed preview. The UI explicitly discloses this behavior, so this is a consistency follow-up rather than a hidden recalculation bug. Baseline/energy/savings reports already reject a changed preview fingerprint.

To meet FP29's consistent screen/export behavior, give carbon previews and downloads a shared content fingerprint (excluding volatile check timestamps), or require users to review refreshed results before download. Keep fresh authorization checks. Test unchanged repeated downloads, factor/reading corrections, portfolio membership changes and revoked access. Server-side archives and scheduled/PDF reports remain later-sprint work.

## Acceptance boundaries

The accepted 0.99 absolute tolerance and confirmed workbook recalculation are unchanged. Methodological approval is still a separate gate for labeling dependent savings as validated or verified. Production-source reconciliation is also outstanding in the acceptance record. These are not newly discovered calculation defects. Sprint 6 verification/AI work and Sprint 7 billing, scheduling, report archives/PDF/narratives are excluded from this review.

Validation for this recheck was source inspection of routes, services, contracts, components and the recorded acceptance evidence; `git diff --check` was run for the documentation changes. Existing test results are historical, not a fresh acceptance run.
