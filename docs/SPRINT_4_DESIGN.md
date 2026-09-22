# Sprint 4 calculation compatibility — implementation design

Status: preparation started, analytical acceptance blocked. Sprint 3 real-export reconciliation remains open. This design and fixture inventory do not close that gate, approve numerical policies, or expose calculated results in the application.

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

Exact schemas/routes will be implemented after the dependent gates are resolved. No new database tables or public calculation endpoints are introduced by this preparation step.

## Result contract and numerical policy boundaries

A successful numerical result should expose ordered coefficients including intercept, fitted values, residuals, sample size, rank, residual degrees of freedom, SSres, SStot, R², regression standard error, coefficient standard errors, t-statistics and two-sided p-values. Reporting output must retain expected and actual kWh, pre-NRA variance, each NRA input/multiplier, final expected/variance and significance classification with its policy version.

Undefined quantities must be represented as typed quality states, not JSON NaN/Infinity, fabricated zero, silently dropped observations or clipped predictions. Proposed states include insufficient observations, singular/near-singular design, constant response, missing input and undefined NRA denominator. Conditioning thresholds, allowable extrapolation and numerical treatments require policy evidence before acceptance.

The design follows the proposed sign convention expected minus actual (positive saving, negative waste), with pre/post NRA quantities retained separately. CD11, significance/p-value boundaries, zero-threshold behaviour and other open choices remain unresolved; this document does not promote their proposed treatments to approved rules. Cost and carbon valuation stay outside this numerical energy engine and belong to Sprint 5.

A rank-aware least-squares implementation should be evaluated against the approved references. Do not infer acceptance from agreement with the old calculator or rounded chart labels. Tolerances must be defined separately for coefficients, fitted/residual values, statistics, p-values and NRA/variance results at unrounded precision; display rounding is a separate concern.

## Ordered implementation slices

1. **Fixture readiness and contracts — delivered as preparation.** Inventory availability/hashes, preserve original evidence and document unresolved dependencies.
2. **Reviewed fixture extraction.** Obtain the single and multi workbooks; resolve the NRA stored-formula/cache conflict with a separately versioned reviewed reference. Record inputs, driver order, units, expected cells/arrays, recalculation evidence and reviewer/provenance. Do not resave the original silently.
3. **Pure engine and golden comparisons.** Implement one/two/three-driver fitting, statistics and NRA with approved numerical policies; compare every expected result family. Add independent algebraic cases and edge/ordering tests without labelling synthetic fixtures as approved workbook evidence.
4. **Persisted input assembly and immutable runs.** Join scoped Sprint 3 consumption/driver/weather versions; add baseline/run/result persistence, scoped services, audit and deterministic reuse tests.
5. **Analysis workflow and acceptance.** Add readiness, baseline selection, results and history in Advanced Analysis. Verify responsive UI, cross-tenant denial, revised input provenance and reproducibility. Complete the three-workbook numerical gate before accepting analytical results.

Sprint 3 export reconciliation can proceed independently while this preparatory work is reviewed. Production migration and cutover remain Sprint 8.
