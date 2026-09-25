# Sprint 6 recheck — 25 September 2026

Reviewed the current working tree against Sprint 6 acceptance, the implementation plan and feature-parity mappings. The four original numbered findings in SPRINT_6_AUDIT.md remain addressed. This recheck identifies two additional follow-ups; its numbering is independent of the original audit.

## 1. Preserve pinned carbon evidence when reviewing an investigation (P2) — addressed

Resolution: “Review saved analysis” now takes the optional carbon run ID from the retained investigation report and includes it alongside site/reporting run in the destination query. It never substitutes a current or latest carbon run. The parameter remains absent for investigations without carbon evidence.

Original finding:

Evidence: apps/web/src/components/opportunities.tsx:314 builds “Review saved analysis” with only site and reporting run. Investigations may retain an explicitly selected carbon run in their saved report, but that identity is omitted from the link. apps/web/src/components/waste-savings.tsx:35 supplies carbon evidence only from the carbon query parameter.

Impact: open an investigation created with compatible carbon evidence, then follow “Review saved analysis.” The destination uses no carbon run and displays carbon as unavailable, even though the investigation snapshot contains it. The original snapshot/export is intact; the navigation fails to preserve the evidence being reviewed.

Completion: derive the carbon ID from the retained investigation report and include it in the link when present. Preserve the existing no-carbon case and tenant/site authorization. Browser coverage should follow the link from a carbon-backed investigation and assert the same reporting/carbon IDs and impacts, including after later source/factor corrections.

## 2. Verification picker needs retry and refresh controls (P2) — addressed

Resolution: reporting and carbon pickers now expose initial-load retry and first-page refresh. Refresh resets pagination and retains the selected immutable run independently of the current page; page loading deduplicates entries. Request generations ignore superseded/unmounted responses, and picker state is scoped to the full request URL. Refresh does not remount the verification form or clear references/explanation. Changing the date/reporting run still clears dependent selections as required.

Original finding:

Evidence: apps/web/src/components/verification-run-picker.tsx:24 fetches the first page only when its URL changes. On failure, it leaves options null and the select disabled (:54). Its only load button requires an existing nextCursor (:78), so an initial failure offers no retry. A successful empty list similarly has no way to refresh after a new run is saved elsewhere. Parent keys change only with the implementation date or selected reporting run (opportunity-verification.tsx:98,108).

Impact: a transient reporting-list failure blocks normal selection; a carbon-list failure prevents choosing optional carbon evidence. Recovery requires a page reload or changing inputs to force a remount. A page reload loses unsaved explanation/references; changing the implementation date clears the run selection.

Completion: add explicit initial-load retry and refresh actions for both pickers. Retain valid selected IDs and entered references/explanation, reset pagination consistently, and prevent stale responses from an old date/run from replacing current options. Browser coverage should simulate a failed first request followed by recovery and discovery of a newly saved eligible run without reloading the form. Include successful optional carbon selection as part of that flow.

## Separate acceptance gates

- Methodology approval remains open. requireVerifiedEligibility deliberately rejects every VERIFIED outcome, and the database independently enforces that restriction. The accepted 0.99 absolute workbook tolerance and confirmed recalculation remain accepted; they do not replace the distinct methodological decision. Full opportunity-through-verified acceptance requires approved versioned policy and positive verification tests.
- OpenAI configuration, live adversarial acceptance and provider-specific recovery/history follow-ups remain deferred by user instruction. They are not new requests to resume external-provider work.
- Subscription-state entitlements/quotas and scheduled reports belong to Sprint 7. Bulk migration belongs to Sprint 8. No new standalone programme builder or global tip catalogue scope was inferred.

## Validation and documentation

Executed five focused test files: opportunities, opportunity verification, supporting evidence, AI evidence and request-body limits. All 77 tests passed. Findings above are based on source/control-flow review; no new browser fault-injection or database integration run was performed for this recheck. The preceding successful browser/database records remain in SPRINT_6_ACCEPTANCE.md.

Corrected the stale current-status paragraph in the acceptance record, which still described the four original findings as open. Historical implementation slices are retained as historical records. No application code was changed for this review.
