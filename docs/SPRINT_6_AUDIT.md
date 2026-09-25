# Sprint 6 review — 25 September 2026

Reviewed and rechecked the current working tree against `V2_IMPLEMENTATION_PLAN.md`, `FEATURE_PARITY.md` and `SPRINT_6_ACCEPTANCE.md`. OpenAI configuration, live acceptance and provider-specific follow-ups remain deferred by user direction. This is a source review with a focused payload-validation check, not a new execution of the test suites. Original finding numbers are retained; the recheck adds point 4.

The opportunity lifecycle, owner/action revisions, supporting evidence, verification submissions, scoped exports and deterministic evidence previews are implemented. Sprint 6 is not fully accepted: the verified outcome still depends on methodology approval, and live AI acceptance is deferred. The following numbered follow-ups can proceed without an external provider.

## 1. Operational-log selection stops at 100 records

`apps/web/src/server/opportunities.ts:136` returns only the newest 100 current operational logs, without a cursor or search input. `apps/web/src/components/opportunity-supporting.tsx:188` offers only that list. A valid older event, or a historical revision replaced by a correction, cannot be selected through the supporting-evidence form even though the write service accepts its scoped ID.

Add scoped, paged/searchable log selection and a way to select a specific historical revision. Keep the selected revision visible while navigating results. Acceptance should include a site with more than 100 logs, a superseded revision, wrong-site/tenant denial and an unchanged pinned snapshot after correction. This is the recommended next implementation step.

## 2. Savings evidence previews cannot include carbon evidence

`apps/web/src/domain/ai-evidence.ts:4` accepts only the primary resource ID, and `apps/web/src/server/ai-evidence.ts:43` dispatches a savings report without a carbon run ID. The preview nevertheless exposes pre/post carbon facts. `apps/web/src/server/analysis/service.ts:477` loads carbon evidence only when a carbon run is explicitly supplied, so those facts remain unavailable even when a compatible saved carbon run exists.

Allow an optional saved carbon run for the savings tool, preserve its identity in the request and citation/source download, and reuse existing scope and reading-revision compatibility checks. Test a compatible run, mismatched meter/site/reading revisions, retries with changed carbon selection and download fidelity. Continue to show unavailable values when no suitable carbon evidence was selected; do not infer a latest run.

## 3. Verification selection requires manual run IDs

`apps/web/src/components/opportunity-verification.tsx:79` and `:83` require plain reporting/carbon ID inputs. The service enforces the correct meter, exact baseline and later period, but users cannot inspect eligible saved runs in the verification form before submitting. This is a usability follow-up, not a missing authorization check or a separate hard acceptance blocker.

Provide a scoped run picker showing meter, baseline, reporting period and result status, with compatible optional carbon evidence. Account for the entered implementation date, explain when no eligible run exists, and retain all server-side checks against forged or stale selections. Cover eligible and ineligible selections plus archived-site read-only behavior.

## 4. Valid field lengths can exceed the API request-size limits

`apps/web/src/app/api/v1/[...segments]/route.ts:80` uses the default 16,384-byte body limit for verification, and `:84` uses 65,536 bytes for action plans. Field schemas and browser forms bound character counts rather than the total encoded JSON size. Valid longer multibyte text therefore passes field validation but is rejected with HTTP 413 by `apps/web/src/server/http.ts:28` before reaching the service.

A local check against the actual Zod schemas confirmed both examples:

- Twenty DONE actions, each with 2,000 copies of a three-byte character as completion evidence: schema accepts; JSON is 124,001 bytes, above the 65,536-byte route limit.
- A verification note of 4,000 three-byte characters and ten references of 499 such characters: schema accepts; JSON is 27,281 bytes, above the 16,384-byte route limit. The combined references also fit the form's 5,000-character bound.

Align bounded request limits with the permitted serialized inputs, or enforce and explain a consistent aggregate byte limit in both UI and server validation. Include JSON escaping as well as UTF-8 in the calculation, and review supporting-evidence limits under the same policy. Test valid boundary payloads through the HTTP body reader and rejection above the chosen cap. This is a functional defect; point 3 remains a usability improvement.

## Separate acceptance gates and deferred scope

- **Methodology approval:** `apps/web/src/domain/opportunity-verification.ts:37` deliberately blocks every VERIFIED outcome; database constraints independently enforce the gate. The accepted 0.99 absolute workbook tolerance and confirmed native recalculation remain accepted. They do not resolve the separately documented methodology decision. Do not remove the block merely to complete the workflow; approval must precede an explicit versioned verification policy and positive verified-outcome tests.
- **OpenAI:** configuration, live adversarial acceptance, pending-attempt reconciliation and provider history improvements remain deferred. Existing mock tests do not establish live provider acceptance.
- **Later or unconfirmed scope:** billing-state integration belongs to Sprint 7; bulk legacy migration belongs to Sprint 8. A global tip catalogue, standalone programme builder and additional analytical tool families are not treated as missing Sprint 6 requirements without a more specific scope decision. Manual programme/tip evidence already preserves the FP31/32 fields and distinguishes recommendations from measured savings.

## Validation baseline

The preceding implementation recorded 246 passing unit tests, analysis/database integration, the analysis browser workflow, typecheck, lint and formatting checks. This review changes documentation only and does not claim those suites were rerun. The recheck executed the actual work/verification input schemas and measured JSON byte lengths for point 4; it did not send authenticated HTTP requests or mutate application data. Follow-up fixes should add focused regression coverage for the cases above.
