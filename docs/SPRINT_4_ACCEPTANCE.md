# Sprint 4 implementation and acceptance evidence — 22 September 2026

Current status: experimental engine, immutable persistence and Advanced Analysis workflow delivered. Numerical compatibility is not accepted; missing reference workbooks, native recalculation and methodology/tolerance approval remain open. Sprint 3 real-export reconciliation remains open independently.

The sections below record successive implementation stages; earlier “not yet implemented” statements describe their stage, not the current product.

Delivered a read-only fixture availability/integrity command and the engine input/result, persistence and service design in SPRINT_4_DESIGN.md. No regression engine, database migration, analytical endpoint or UI calculation was introduced.

The real-directory check recorded in sprint-4-fixture-readiness.json exited 2 as designed: the single- and multi-driver references are missing, and the NRA source matches its prior discovery hash. At that time the report still carried the subsequently withdrawn CD11 conflict claim. Expected results, native recalculation evidence, numerical tolerances and calculation policies remain unresolved. Matching bytes alone never imply approval.

Verification:

- 49 unit tests across 16 files passed. New tests cover missing references, non-file paths, changed source hashes, read-only preservation and the inability of arbitrary fixture bytes to imply acceptance.
- TypeScript and targeted ESLint passed.
- The CLI wrote the real-source metadata report with private permissions and refused a repeated output filename without changing it.
- No database or external provider was accessed; existing local preview remained running. Workbook formulas/cached values were not recalculated or altered.

Next dependent slice: obtain and review the missing single/multi references, review the NRA source evidence and native recalculation and record approved expected results, policies and tolerances before accepting numerical compatibility. The proposed architecture remains reviewable preparation, not approval of those decisions.

## Available-reference extraction and CD11 correction

A hash-pinned read-only Python extractor now records 494 evidence cells from the known NRA reference, including raw formulas, cached values, source addresses and labels. Direct XML inspection disproved the earlier shifting-mean claim: B38:M38 all use B9:M9. COMPATIBILITY_DECISIONS.md, the Sprint 4 design and the executable readiness dependencies now reflect that correction. The updated report is sprint-4-fixture-readiness-verified.json; the original report remains historical evidence.

Four standard-library Python tests passed for raw formula/cache preservation, shared-formula detection, genuine shifted-formula rejection, zero values, range limits, XML declarations and hash mismatch with unchanged source bytes. The real-source CLI extraction was verified for mode-0600 output, refusal to overwrite, and unchanged original SHA-256. No full native recalculation or golden acceptance is claimed. See NRA_FIXTURE_REVIEW.md.

After this extraction change, the two fixture-readiness unit tests, TypeScript and targeted ESLint passed. No application database or runtime calculation behaviour changed.

## First numerical slice: experimental QR regression

Implemented the isolated pure TypeScript one/two/three-driver OLS kernel, including intercept, stable driver ordering, fitted values/residuals, SSres/SStot/R², residual standard error and residual degrees of freedom. It returns typed blocked states for invalid/insufficient/dependent/unrepresentable inputs, retains zero observations and leaves undefined constant-response R² null. All results are explicitly UNVALIDATED; no application/API/database caller was introduced. See SPRINT_4_ENGINE.md for method references, provisional numerical policy, independent exact-rational test evidence and NRA cache characterization.

Workbook compatibility remains unapproved. Persisted input assembly and the user workflow remain later slices. No test evidence is substituted for the missing single/multi workbook references or methodology approval.

Validation: all 60 unit tests across 17 files passed. After adding the residual-underflow guard, all 11 regression cases were rerun and passed. TypeScript, targeted ESLint and `git diff --check` passed. Source inspection confirmed the kernel has no application callers. No database migration, browser rebuild or production build was needed for this isolated numerical module.

## Coefficient inference slice

Experimental algorithm v2 now returns covariance, coefficient standard errors, signed t-statistics and two-sided Student-t probabilities. Undefined zero-variance inference, covariance overflow, t overflow and probability underflow are explicitly represented without nonfinite JSON or invented significance. The module remains disconnected from the application and all fits remain UNVALIDATED.

All 110 unit tests across 18 files passed, including 50 inference tests: exact-rational covariance, analytic intercept cross-covariance, 42 independently integrated Student-t reference points, symmetry, row/driver reordering, unit scaling, zero variance, covariance overflow and extreme-tail handling. TypeScript, targeted ESLint and `git diff --check` passed. The available NRA source was characterized read-only against cached coefficient SE/t/p values; maximum absolute p-value difference was about 1.12e-15. No full native recalculation, golden workbook acceptance or significance policy approval is claimed.

Reporting predictions, NRA and significance are now implemented with explicit policy and month/scope matching. Workbook references, policy/tolerance approval and later persistence/UI gates remain open.


## Reporting slice

Experimental reporting v1 and regression v3 now support stable centered predictions, optional hours/population NRA, explicit reference-month joins, pre/post-NRA significance policies and inclusive/strict boundaries. Scope conflicts, duplicates, zero denominators and missing months cannot silently produce results. Extrapolation, negative predictions and zero thresholds require explicit policies. Results retain an input snapshot and remain UNVALIDATED; no live workflow is enabled.

Validation: 128 unit tests across 19 files passed, including 18 reporting tests; TypeScript, targeted ESLint and diff whitespace checks passed. Available NRA cache characterization matched all 12 significance flags and adjustment factors; maximum expected/adjusted/final variance difference was 2.14e-14 kWh. This does not approve workbook compatibility. Next: authorized persisted input assembly and baseline/run snapshots.


## Persisted input assembly and immutable snapshots

Delivered the internal authorized service and migration for baseline versions, analysis runs and results. Inputs resolve from current scoped source revisions; baseline inputs and fitted model remain frozen. Reporting corrections produce new hashes/runs. Retrying identical requests reuses the original row and audit entry. Month gaps and numerical failures block persistence; snapshot/result/audit writes roll back together. Database constraints/triggers enforce scoped relations, revision lineage and immutable rows.

Validation: all 131 unit tests across 20 files passed. The new `scripts/analysis-integration.ts` suite passed against a fresh temporary PostgreSQL database, including concurrent retries, membership/site permissions, correction history, pinned weather, frozen NRA references, estimated-input policy, missing inputs, database mutation rejection and audit-failure rollback. Prisma client generation, TypeScript, targeted ESLint and whitespace checks passed. The integration script is included in `test:integration`.

The migration is staged and tested, not applied to the existing workspace database. No endpoint or page exposes analytical results yet. Workbook acceptance remains open; the next slice is the Advanced Analysis readiness, baseline and history workflow.


## Advanced Analysis workflow

The experimental workflow is now available from Energy → Advanced Analysis: site selection, readiness, immutable baseline saving, reporting policies and NRA reference months, saved runs/history, numerical summaries and full provenance. Dedicated Owner/Admin/Analyst analysis-write authorization and site-scoped reads are enforced by the service; API requests use existing authentication/origin/body-limit protections.

Validation passed: 131 unit tests; PostgreSQL integration tests including new options/baseline read authorization; focused Chromium desktop/mobile workflow test; TypeScript and targeted ESLint. The browser test covers missing inputs, changed-definition readiness, blocked extrapolation, successful run saving/reuse, reload/history and 390px width. Local migration deployment succeeded and the signed-in workspace page was visually verified. No workbook/methodology acceptance is inferred. The earlier “no endpoint/UI” and “migration not applied locally” notes describe the preceding slice and are now superseded.

## NRA and read-only acceptance follow-up

Results now expose pre-NRA variance, final variance and significance threshold, plus a readable NRA reference-input table with months, values, units and individual ratios. Estimated-consumption warnings are visible for both baseline and reporting inputs. Human-readable driver-range warnings replace internal codes in the results table. The saved reporting period makes clear that existing results do not change when the reporting form is edited. Driver checkboxes align with their labels on mobile.

Validation passed: all 131 unit tests, TypeScript, targeted ESLint/formatting and whitespace checks. The expanded Chromium test passed desktop/mobile checks, two reporting months with distinct NRA reference months and factors (10 and 1.5), refusal to save a zero-denominator run, visible estimated-reading warnings, saved history reload, viewer read access and denied API writes, and Site Manager access denied without assignment and restored after assignment. Screenshots were inspected. Tests used a disposable database and local test mail; no workspace data was seeded or changed by this follow-up.

Remaining acceptance gates: obtain/review the missing single- and multi-driver workbooks, obtain native recalculation evidence for NRA, and approve the methodology/tolerance policies before claiming numerical compatibility. Analyst analytical-work permission and history pagination are delivered in the follow-ups below. Sprint 3 real-source reconciliation remains separately open.


## Full history access

Replaced the 100-entry history cutoff with bounded cursor pages and independent controls for older baselines and runs. Cursors remain scoped to the authorized tenant/site/baseline. Stable timestamp/UUID ordering avoids duplicates or skipped older entries when timestamps tie or a new newest entry is inserted during traversal.

Validation: 132 unit tests passed, including page-limit/cursor validation. PostgreSQL integration checks passed with more than 100 synthetic baselines and runs, exact ordered traversal, concurrent newest insertion, nested run continuation and cross-scope cursor denial. TypeScript and targeted ESLint passed. No application database migration or record changes were needed.

The expanded Chromium workflow also passed: real one-item history pages exercised both load-more buttons, append without losing loaded entries, and button removal at exhaustion. The same test reverified NRA, saved-run reuse, read-only roles, assigned-site access and mobile width. The browser harness used its disposable database; current workspace data was unchanged.


## Analyst model and NRA access

Added `analysis:write` for Owner/Admin/Analyst and used it consistently in the service and save controls. This completes the master specification's models/NRA role responsibility without broadening organisation, team, billing, audit-feed or source-data permissions. Site Manager and Viewer remain read-only for analysis.

Validation: 133 unit tests passed; TypeScript and targeted ESLint passed. Isolated PostgreSQL integration verified Analyst baseline/NRA writes and audit attribution, denied admin/source writes, scope rejection, immediate demotion/revocation and continued read access after demotion to Viewer. No schema migration or workspace membership changes were made. Workbook and methodology approval remain open.

The expanded Chromium workflow also passed: an Analyst sees save controls, creates a baseline and NRA run, lacks Settings/Team links and membership API access, then loses write access immediately after demotion to Viewer. Existing pagination, read-only/site-assignment, NRA and mobile checks remained green. Role changes occurred only in the disposable browser-test workspace.
