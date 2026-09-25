# Sprint 6 review — 25 September 2026

Latest follow-up: [Sprint 6 recheck](SPRINT_6_RECHECK.md). Original points 1–4 are addressed; the recheck records the two additional navigation/recovery fixes.

Reviewed and rechecked the current working tree against `V2_IMPLEMENTATION_PLAN.md`, `FEATURE_PARITY.md` and `SPRINT_6_ACCEPTANCE.md`. OpenAI configuration, live acceptance and provider-specific follow-ups remain deferred by user direction. This is a source review with a focused payload-validation check, not a new execution of the test suites. Original finding numbers are retained; the recheck adds point 4.

The opportunity lifecycle, owner/action revisions, supporting evidence, verification submissions, scoped exports and deterministic evidence previews are implemented. Sprint 6 is not fully accepted: the verified outcome still depends on methodology approval, and live AI acceptance is deferred. The following numbered follow-ups can proceed without an external provider.

## 1. Operational-log selection — addressed

Resolution: supporting evidence now offers 25-record cursor pages, case-insensitive code/operation search, an explicit historical-revision filter and exact revision-ID lookup. The selected revision stays available through searches and pagination. Superseded revisions are labelled, while attachment still pins the exact immutable source snapshot. Every query and cursor is restricted to the current tenant/site and existing evidence-write permissions. See the Sprint 6 acceptance record for validation.

Original finding:

`apps/web/src/server/opportunities.ts:136` returns only the newest 100 current operational logs, without a cursor or search input. `apps/web/src/components/opportunity-supporting.tsx:188` offers only that list. A valid older event, or a historical revision replaced by a correction, cannot be selected through the supporting-evidence form even though the write service accepts its scoped ID.

Completion criteria: scoped, paged/searchable log selection and a way to select a specific historical revision; selected revisions stay visible while navigating results. Coverage includes a site with more than 100 logs, a superseded revision, wrong-site/tenant denial and an unchanged pinned snapshot after correction.

## 2. Savings evidence previews cannot include carbon evidence — addressed

Resolution: savings previews accept an optional saved carbon run ID, bind it into retry identity, and derive its citation ID from the validated savings report. Source download links include both saved run IDs and the report fingerprint. Existing tenant/site/meter checks and exact reading-revision matching are reused; missing or incompatible reading evidence remains unavailable. No latest run is inferred. See the Sprint 6 acceptance record for validation.

Original finding:

`apps/web/src/domain/ai-evidence.ts:4` accepts only the primary resource ID, and `apps/web/src/server/ai-evidence.ts:43` dispatches a savings report without a carbon run ID. The preview nevertheless exposes pre/post carbon facts. `apps/web/src/server/analysis/service.ts:477` loads carbon evidence only when a carbon run is explicitly supplied, so those facts remain unavailable even when a compatible saved carbon run exists.

Allow an optional saved carbon run for the savings tool, preserve its identity in the request and citation/source download, and reuse existing scope and reading-revision compatibility checks. Test a compatible run, mismatched meter/site/reading revisions, retries with changed carbon selection and download fidelity. Continue to show unavailable values when no suitable carbon evidence was selected; do not infer a latest run.

## 3. Verification selection requires manual run IDs — addressed

Resolution: verification uses scoped reporting/carbon selectors with 25-record cursor pages. Reporting choices show period, calculation/validation status and immutable ID alongside the meter and exact baseline. Original/overlapping periods and periods before the entered implementation date are disabled with explanations. Carbon choices require matching meter, calculated months, reading revisions and factors. Date/run changes reset dependent selections. The existing submission checks and archived-site read-only behavior remain enforced. See the acceptance record for validation.

Original finding:

`apps/web/src/components/opportunity-verification.tsx:79` and `:83` require plain reporting/carbon ID inputs. The service enforces the correct meter, exact baseline and later period, but users cannot inspect eligible saved runs in the verification form before submitting. This is a usability follow-up, not a missing authorization check or a separate hard acceptance blocker.

Provide a scoped run picker showing meter, baseline, reporting period and result status, with compatible optional carbon evidence. Account for the entered implementation date, explain when no eligible run exists, and retain all server-side checks against forged or stale selections. Cover eligible and ineligible selections plus archived-site read-only behavior.

## 4. Valid field lengths can exceed the API request-size limits — addressed

Resolution: opportunity creation/review now use 32 KiB caps, action plans 320 KiB, verification 64 KiB and supporting evidence 160 KiB. Budgets cover schema-maximal contents at six JSON bytes per UTF-16 code unit, including escaped keys/IDs and structural overhead. Existing field validation and streamed byte enforcement remain unchanged. Finite transport caps still reject excessive padding. Boundary tests exercise the actual HTTP body reader with multibyte text, surrogate pairs, controls, quotes/backslashes, lone surrogates and fully escaped JSON. See the acceptance record.

Original finding:

`apps/web/src/app/api/v1/[...segments]/route.ts:80` uses the default 16,384-byte body limit for verification, and `:84` uses 65,536 bytes for action plans. Field schemas and browser forms bound character counts rather than the total encoded JSON size. Valid longer multibyte text therefore passes field validation but is rejected with HTTP 413 by `apps/web/src/server/http.ts:28` before reaching the service.

A local check against the actual Zod schemas confirmed both examples:

- Twenty DONE actions, each with 2,000 copies of a three-byte character as completion evidence: schema accepts; JSON is 124,001 bytes, above the 65,536-byte route limit.
- A verification note of 4,000 three-byte characters and ten references of 499 such characters: schema accepts; JSON is 27,281 bytes, above the 16,384-byte route limit. The combined references also fit the form's 5,000-character bound.

Align bounded request limits with the permitted serialized inputs, or enforce and explain a consistent aggregate byte limit in both UI and server validation. Include JSON escaping as well as UTF-8 in the calculation, and review supporting-evidence limits under the same policy. Test valid boundary payloads through the HTTP body reader and rejection above the chosen cap. This is a functional defect; point 3 remains a usability improvement.

All four numbered audit follow-ups are now addressed. Full Sprint 6 acceptance still depends on the separate gates below.

## Separate acceptance gates and deferred scope

- **Methodology approval:** `apps/web/src/domain/opportunity-verification.ts:37` deliberately blocks every VERIFIED outcome; database constraints independently enforce the gate. The accepted 0.99 absolute workbook tolerance and confirmed native recalculation remain accepted. They do not resolve the separately documented methodology decision. Do not remove the block merely to complete the workflow; approval must precede an explicit versioned verification policy and positive verified-outcome tests.
- **OpenAI:** configuration, live adversarial acceptance, pending-attempt reconciliation and provider history improvements remain deferred. Existing mock tests do not establish live provider acceptance.
- **Later or unconfirmed scope:** billing-state integration belongs to Sprint 7; bulk legacy migration belongs to Sprint 8. A global tip catalogue, standalone programme builder and additional analytical tool families are not treated as missing Sprint 6 requirements without a more specific scope decision. Manual programme/tip evidence already preserves the FP31/32 fields and distinguishes recommendations from measured savings.

## Validation baseline

The preceding implementation recorded 246 passing unit tests, analysis/database integration, the analysis browser workflow, typecheck, lint and formatting checks. This review changes documentation only and does not claim those suites were rerun. The recheck executed the actual work/verification input schemas and measured JSON byte lengths for point 4; it did not send authenticated HTTP requests or mutate application data. Follow-up fixes should add focused regression coverage for the cases above.
