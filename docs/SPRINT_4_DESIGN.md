# Sprint 4 calculation compatibility — implementation design

Status: experimental engine, persistence and workflow delivered; analytical acceptance remains blocked. Sprint 3 real-export reconciliation remains open. This design and fixture inventory do not close that gate, approve numerical policies, or expose calculated results in the application.

## First delivered step: reproducible fixture readiness

From `apps/web`:

```sh
npm run sprint4:readiness -- /path/to/fixture-directory /path/to/new-report.json
```

Omit the output path to print JSON. The command checks the three exact fixture filenames, streams SHA-256 checksums with a 20 MB per-file cap, compares the known NRA discovery hash and reports outstanding review dependencies. It never parses, recalculates or changes workbooks, connects to the database or calls an external provider. Reports use exclusive creation with mode 0600; existing files are not overwritten.

Exit 2 means the review gate remains open; exit 1 means the command/output failed. This preparation tool deliberately has no successful acceptance path yet: all fixtures remain unapproved, including files that match discovery hashes. A future approved fixture registry and numerical golden suite must replace these review dependencies with evidence; changing an output report is not approval. Test the tool with `npm test -- tests/fixture-readiness.test.ts`.

The checked source directory is supplied at runtime, not embedded in the code. Reports contain filenames, sizes, hashes and readiness metadata, not workbook cell values or source-directory paths.

## Calculation boundary and input contract

The planned engine is pure TypeScript with no database, HTTP, clock, workbook parser or tenant lookup inside its numerical functions. A server-side assembler authorizes access and resolves persisted versions before invoking it. The UI cannot supply trusted regression coefficients or substitute arbitrary site observations.

An input snapshot must contain:

- Algorithm and methodology-policy versions, approved fixture-set version and numerical tolerance-policy reference.
- Organisation, site, meter and optional registered end-use scope; source unit and normalized energy unit; explicit baseline and reporting calendar-month ranges.
- Stable ordered driver definitions: one, two or three drivers with code, unit and source definition. Select a fixed column set for the entire model; zero is data and missing values are blockers.
- Baseline rows joined by scope and month, each with consumption revision ID, normalized kWh, driver values and driver/weather version references. Reject duplicate months, mixed scopes and mismatched array lengths before fitting.
- Reporting rows with the same driver definitions and explicit observed consumption. Missing reporting inputs remain individually identified; they never become zero or borrowed observations from another meter/site.
- Optional NRA inputs matched to each reporting month: baseline/reference and reporting operating-hours/population values with their observation IDs and an explicit source basis. Schedules, annual pattern days and occupancy counts are not substitutes for observed monthly drivers.

Store the complete resolved snapshot and a deterministic hash. IDs alone are insufficient because later current-version queries could resolve different data. Sorting for hashing must also define coefficient/driver order and preserve numeric precision, explicit nulls and units.

## Planned persistence and service contract

`BaselineVersion` is an immutable, organisation-owned definition linking one site/meter/end-use scope, baseline range, driver selection and methodology policy. Corrections append a version and preserve the previous definition. Model fitting does not mutate an existing baseline.

`AnalysisRun` captures the requested baseline version, reporting range, complete input snapshot/hash and algorithm/policy versions. `AnalysisResult` retains numerical outputs and explicit quality states. Composite tenant foreign keys must protect baseline/run/result relationships. Repeated requests for the same authorized immutable inputs reuse a run; new input revisions produce a new run. Retrying never rewrites historical results.

Proposed service operations:

| Operation | Behaviour |
| --- | --- |
| Inspect readiness | Read-only, authorized scope; return missing months/drivers/weather, duplicates, inconsistent units and unresolved policy references |
| Create baseline version | Authorized write; validate scope and driver definitions, append definition and audit event atomically |
| Run analysis | Resolve one consistent input snapshot, validate readiness, execute the pure engine, atomically save run/result/audit; no partial numerical result on failure |
| Read run/history | Apply tenant and assigned-site read rules; expose snapshot provenance and superseding versions without recalculating history |

The persistence/service slice below now implements these experimental schemas. Public calculation routes and analytical acceptance remain gated.

## Result contract and numerical policy boundaries

A successful numerical result should expose ordered coefficients including intercept, fitted values, residuals, sample size, rank, residual degrees of freedom, SSres, SStot, R², regression standard error, coefficient standard errors, t-statistics and two-sided p-values. Reporting output must retain expected and actual kWh, pre-NRA variance, each NRA input/multiplier, final expected/variance and significance classification with its policy version.

Undefined quantities must be represented as typed quality states, not JSON NaN/Infinity, fabricated zero, silently dropped observations or clipped predictions. Proposed states include insufficient observations, singular/near-singular design, constant response, missing input and undefined NRA denominator. Conditioning thresholds, allowable extrapolation and numerical treatments require policy evidence before acceptance.

The design follows the proposed sign convention expected minus actual (positive saving, negative waste), with pre/post NRA quantities retained separately. Native recalculation evidence, significance/p-value boundaries, zero-threshold behaviour and other open choices remain unresolved; this document does not promote their proposed treatments to approved rules. Cost and carbon valuation stay outside this numerical energy engine and belong to Sprint 5.

A rank-aware least-squares implementation should be evaluated against the approved references. Do not infer acceptance from agreement with the old calculator or rounded chart labels. Tolerances must be defined separately for coefficients, fitted/residual values, statistics, p-values and NRA/variance results at unrounded precision; display rounding is a separate concern.

## Ordered implementation slices

1. **Fixture readiness and contracts — delivered as preparation.** Inventory availability/hashes, preserve original evidence and document unresolved dependencies.
2. **Reviewed fixture extraction.** Obtain the single and multi workbooks; review the extracted NRA source evidence and obtain native recalculation evidence. The CD11 shifting-range claim was withdrawn after direct XML inspection; no corrected workbook is required on that basis. Record inputs, driver order, units, expected cells/arrays, recalculation evidence and reviewer/provenance. Do not resave the original silently.
3. **Pure engine and golden comparisons.** Implement one/two/three-driver fitting, statistics and NRA with approved numerical policies; compare every expected result family. Add independent algebraic cases and edge/ordering tests without labelling synthetic fixtures as approved workbook evidence.
4. **Persisted input assembly and immutable runs.** Join scoped Sprint 3 consumption/driver/weather versions; add baseline/run/result persistence, scoped services, audit and deterministic reuse tests.
5. **Analysis workflow and acceptance.** Add readiness, baseline selection, results and history in Advanced Analysis. Verify responsive UI, cross-tenant denial, revised input provenance and reproducibility. Complete the three-workbook numerical gate before accepting analytical results.

Sprint 3 export reconciliation can proceed independently while this preparatory work is reviewed. Production migration and cutover remain Sprint 8.

Read-only NRA extraction is now available through `scripts/extract_nra_evidence.py`; see [NRA_FIXTURE_REVIEW.md](NRA_FIXTURE_REVIEW.md). This delivers the available-reference portion of slice 2, while missing references and result/policy review remain open.

The first part of slice 3 is now implemented as an isolated experimental QR regression kernel (one to three drivers, coefficients, fitted/residual values, R² and residual standard error). All outputs remain UNVALIDATED; no live analytical results are exposed. See [SPRINT_4_ENGINE.md](SPRINT_4_ENGINE.md) for the numerical contract and integration boundaries. Synthetic and available-reference characterization can progress while workbook acceptance remains blocked.

The coefficient-inference slice is also implemented in experimental algorithm v2: covariance, coefficient standard errors, t-statistics and two-sided probabilities with explicit undefined/underflow states. Reporting prediction, NRA and significance are now implemented as a separate experimental pure module with explicit policies and scope/month validation. No significance labels or live calculation endpoint have been introduced.

Regression v3 adds observed predictor ranges. Reporting v1 retains source snapshots, explicit reference-month joins and incomplete-month states. Authorized persisted input assembly and immutable baseline/run snapshots are now implemented; fixture approval remains a separate gate.


## Delivered persistence and assembly slice

`src/server/analysis/service.ts` adds `inspectReadiness`, `createBaseline`, `run`, `history` and `readRun`. Baseline and run requests accept definitions, periods, driver selections and explicit policies; they cannot supply numerical observations, fitted coefficients or trusted result objects. Source values come from scoped current consumption/driver revisions and explicitly pinned weather configuration/methodology. Baseline observations and fit are frozen at creation; reporting corrections change run hashes without refitting old baselines. Refreshing baseline data requires creating another baseline version, with optional explicit supersession.

Migration `202609220001_analysis_snapshots` adds `BaselineVersion`, `AnalysisRun` and `AnalysisResult` with composite organisation/site/meter foreign keys, end-use scope and same-scope baseline lineage. Database triggers reject UPDATE, DELETE and TRUNCATE. Baseline revision numbers advance by one; branching from a superseded version is rejected. Run/result/audit inserts are atomic. Serializable transactions, organisation write locks, bounded serialization/uniqueness retries and unique hashes provide deterministic request reuse. Failed readiness, fitting or reporting does not persist partial results. An audit insert failure rolls back the entire operation.

The canonical SHA-256 input identity sorts JSON object keys and keeps array order meaningful. Consumption and driver source decimals are retained as strings in provenance, alongside the numeric engine inputs; snapshots also preserve source metadata, weather monthly results, configuration, methodology and weather input hashes. Daily weather payloads are not duplicated. Explicit nulls and source revision IDs remain part of the snapshot. Reporting NRA uses the saved baseline observations, never a fresh baseline-period query. Schedules, attributes, occupancy and pattern observations are not substituted for monthly drivers. Weather enrichment is never triggered by analysis.

Baseline/run writes now use the dedicated Owner/Admin/Analyst analysis permission. Active members may read; Site Managers are restricted to assigned sites, and revoked/unverified memberships are denied. Archived sites/meters cannot create runs. History uses scoped cursor pagination for baselines and runs; direct run reads remain scoped and return complete provenance. This implements the specification’s Analyst models/NRA responsibility.

Readiness includes missing/ambiguous months, weather coverage, estimated-consumption policy and numerical fit blockers. A ready result means inputs can be fitted experimentally, not that methodology is approved. Every saved baseline/run is constrained to UNVALIDATED, with null approved-fixture/tolerance references. The service now backs authenticated analysis routes and the experimental UI. The migration was tested in disposable databases and then applied to the verified local workspace database.

Validation: 131 unit tests passed, plus the dedicated isolated PostgreSQL integration suite covering scoped access, assigned-site/revoked access, concurrent reuse/single auditing, consumption corrections, frozen NRA inputs, baseline supersession, weather configuration resolution, estimated policy, missing inputs, database immutability/composite constraints and audit-failure rollback. Prisma generation, TypeScript and targeted ESLint passed. The next slice is the Advanced Analysis readiness/baseline/history workflow, retaining experimental status until reference and policy approval.


## Delivered Advanced Analysis workflow

The `/org/[organisationId]/analysis` page now exposes site-scoped input readiness, baseline creation/selection, reporting policy selection, NRA reference-month mapping, saved run results and history. Every page/result clearly identifies experimental, unvalidated status. Source inputs and fitting policies are preserved; baseline and run diagnostics/provenance are expandable. Readiness clears when the definition changes. Missing inputs and numerical blockers are displayed, and reporting errors are also shown beside the reporting form. Saving the same run reuses the existing entry.

Authenticated API routes under `/api/v1/organisations/:org/sites/:site/analysis` provide options, readiness, baselines, runs and history. They use the existing origin checks, request-size limits, problem responses and no-store headers. The service enforces Owner/Admin/Analyst analysis writes and assigned-site read checks. The page hides save controls for read-only roles. Changing site resets selected baseline/results and ignores stale option-loading responses.

Validation: 131 unit tests, the expanded PostgreSQL integration suite, TypeScript and targeted ESLint passed. A focused Chromium test passed the complete flow: missing months, readiness invalidation, baseline creation, extrapolation blocking, explicit warning policy, run reuse, reload/history, rejected cross-origin writes and 390px mobile layout without page overflow. Desktop/mobile screenshots were inspected. The additive analysis migration was applied to the verified local `energiepad_v2` database, and the local Advanced Analysis page was verified in the signed-in workspace.

This supersedes the earlier internal-service-only deployment notes above. Workbook approval and the remaining methodology decisions still gate analytical acceptance; exposing an experimental workflow does not close them. Next: review the workflow against Sprint 4 acceptance, expand scenario coverage (especially NRA and read-only browser flows), and resolve the outstanding reference/policy evidence.


## NRA evidence and read-only acceptance follow-up

The results table now shows variance before and after NRA plus the significance threshold. A separate NRA evidence table lists each reporting month, observation kind, selected reference month, reference/reporting values with units, and ratio. Baseline/reporting estimated-consumption warnings are visible outside raw JSON. Driver-range warnings use readable labels; the saved reporting period distinguishes a historical result from edits to the current form. Driver checkbox labels now align horizontally.

The expanded browser scenario covers two reporting months with different reference months and adjustment factors, a zero reference denominator that must not save a run, estimated consumption under an explicit allow policy, viewer history/results with no write controls, direct viewer write denial, and Site Manager access before and after site assignment. These application acceptance scenarios do not replace workbook compatibility evidence.


## Complete history pagination

`history` now returns `{ items, nextCursor }`. Each baseline summary includes an initial `runs` page and `nextRunCursor`. `GET .../analysis/baselines/:id/runs` loads subsequent run summaries. Both endpoints accept an optional UUID `cursor` and integer `limit` (default 20, maximum 100). This replaces the initial experimental history array response; its UI and browser tests have been updated together.

Cursors are resolved inside the authorized organisation/site (and baseline for run pages). Unknown or cross-scope cursors are rejected. Rows are ordered by creation time descending, then UUID ascending, using the cursor's timestamp/ID as the continuation boundary. Equal timestamps are deterministic; a newly inserted newest item does not shift an ongoing traversal. Loading begins again from the latest page after a save. No mutable snapshot or timestamp is accepted from the browser as a trusted cursor.

The history UI provides independent “Load older baselines” and per-baseline “Load older runs” controls, preserves loaded entries on append and removes controls at exhaustion. Changing site resets paging state. Saved calculations are never recomputed by paging, and loading older baselines also makes them available in the supersession selector.

Database integration tests traverse over 100 baselines and runs with dense timestamp ties, compare the complete ordered IDs, insert a newer item between page requests, and reject wrong-site/wrong-baseline/unauthorized cursors. No schema migration is required.


## Analyst analytical-work permission

`analysis:write` now permits Owner/Admin/Analyst in both AnalysisService and Advanced Analysis save controls. Organisation management permissions are unchanged. This follows the master specification's Analyst “Data, models, NRA, AI, opportunities” responsibility and the Sprint 1 analytical-work role. Only the models/NRA portion is addressed here; no broader source-data/admin permission is inferred.

Unit checks cover the complete role matrix. Isolated integration checks exercise Analyst baseline and NRA creation with author/audit evidence, administrative and consumption-write denial, scoped-meter rejection, immediate demotion write denial, retained Viewer reads and revoked-membership denial. No migration or live membership changes are required.
