# Sprint 4 workbook review — 23 September 2026

Current decision update, 24 September 2026: the user approved **0.99 absolute difference**, with relative tolerance **0**, and confirmed that all three supplied workbooks have been fully recalculated. These resolve the earlier ambiguous-tolerance and user-confirmation requests below. Recalculation is recorded as user-attested; no Excel version/build or execution log is fabricated. Fresh comparison passes all 305 numerical values and all 36 significance decisions. Methodology/coverage approval remains separate from this numerical agreement.

Status: all three original references located and characterized. **Acceptance remains blocked** pending reviewed Excel recalculation, expected results, tolerances and calculation decisions. This supersedes earlier missing-file reports; it does not approve the sources.

## Provenance

Originals are in `/home/leonardo/Downloads`. Extraction and comparison open them read-only. Every run verifies the recorded byte hash before selecting a layout; changed files require a new layout review.

| Reference | SHA-256 | Numeric comparisons | Significance flags |
| --- | --- | ---: | ---: |
| Single Routine Adjustment V2.xlsx | `40dfaa6aaaeed910fa49552bab2d9ef629adf91b6982796372cf8f941e7821cd` | 82 | 12/12 agree |
| Multi Routine Adjustment V2.xlsx | `96d03f58b3caf94429f86b257ddb316cb4f3bf96f4e11cf8c3bbaf7a4c2a77cb` | 91 | 12/12 agree |
| Multi Routine Adjustment Plus NRA V2.xlsx | `427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed` | 132 | 12/12 agree |

## Reviewed layout and coverage

All cells below belong to `Regression Analysis`; monthly columns are B:M. Source labels identify baseline 2022 and reporting 2023. Driver units are provisionally HDD/CDD in C·day and daylight in hours; metadata requires methodology review. A1/A2 identify different sites in the single and multi workbooks, so the harness uses isolated synthetic scope IDs and never imports these headers into application data.

| Output | Single | Multi | Multi + NRA |
| --- | --- | --- | --- |
| Baseline drivers / response | rows 6 / 7 | rows 6–7 / 8 | rows 6–8 / 9 |
| Intercept then driver coefficients | L17, J17 | J21:L21 | A29:D29 |
| Fitted / residual / squared residual | rows 23–25 | rows 27–29 | rows 35–37 |
| SSE / SST / R² / residual SE | A29, D29, G29, A32 | A33, D33, G33, A36 | A41, D41, G41, A44 |
| SE / t / df / p | C39, E39, G39, I39 (slope only) | C:F, rows 41–43 | C:F, rows 49–52 |
| Reporting drivers / actual | rows 46 / 47 | rows 49–50 / 51 | rows 58–60 / 61 |
| Expected / variance | rows 49 / 51 | rows 53 / 55 | rows 63 / 65 before NRA |
| NRA factor / adjusted expected / final variance | Not applicable | Not applicable | rows 81 / 82 / 84 |
| Threshold / significance | rows 58 / 62 | rows 62 / 66 | rows 91 / 95 |

The single workbook provides no intercept SE/t/p reference. These engine outputs have synthetic mathematical coverage, but are not workbook-validated. Covariance, undefined cases and interpretation boundaries likewise require supplemental acceptance fixtures; these monthly datasets alone do not establish those behaviors.

## Findings requiring decisions

1. **Numeric precision:** single/multi caches generally retain about ten significant digits. Their differences from full-precision engine results are small but nonzero. NRA caches retain greater precision. Do not use rounded string equality or a global exact-match test.
2. **Tiny probability:** multi F43 caches zero; engine gives `4.339647335462425e-14`. Keep the nonzero engine value. A tolerance must not silently approve loss of this distinction.
3. **Interpretation:** single K29 and NRA K41 use ≥0.90/0.80/0.75, then Unreliable. Multi K33 adds ≥0.50 Weak, then Exclude. Single K39 and NRA H49:H52 use strict p boundaries; multi H41:H43 and the specification use inclusive boundaries. The application's existing provisional, versioned specification-inclusive p policy and NRA-based R² policy remain unchanged. Agree one governing policy before compatibility approval.
4. **Periods and metadata:** confirm calendar mapping, units, driver order, header identity discrepancy and monthly NRA reference pairing. Native hourly/weather methodology cannot be inferred from these aggregated numbers.

### Largest measured absolute cache differences

| Family | Single | Multi | Multi + NRA |
| --- | ---: | ---: | ---: |
| coefficients | 2.14384e-08 | 2.86136e-07 | 7.77156e-16 |
| fitted | 4.61964e-08 | 3.68731e-07 | 1.42109e-14 |
| residuals | 4.21853e-09 | 3.59881e-09 | 1.42109e-14 |
| squaredResiduals | 4.71565e-07 | 3.93853e-07 | 6.03961e-14 |
| ssResidual | 2.95989e-06 | 2.33035e-07 | 5.68434e-14 |
| ssTotal | 3.33333e-06 | 3.33333e-07 | 0 |
| rSquared | 1.6263e-15 | 6.09526e-13 | 5.55112e-16 |
| regressionSE | 8.68901e-10 | 2.51353e-09 | 1.33227e-15 |
| coefficientSE | 2.34551e-10 | 1.20644e-09 | 1.33227e-15 |
| tStatistics | 2.49128e-12 | 2.29606e-09 | 5.32907e-15 |
| degreesOfFreedom | 0 | 0 | 0 |
| pValues | 2.99947e-11 | 1.42762e-11 | 1.11022e-15 |
| expected | 4.74412e-08 | 4.74926e-07 | 2.13163e-14 |
| significanceThreshold | 1.7378e-09 | 4.97295e-09 | 2.66454e-15 |

### Proposed tolerance contract — not approved

Use `abs(actual − expected) ≤ absolute + relative × abs(expected)` on unrounded values. Record the approved values **for each fixture and result family**, separately for original caches and reviewed recalculated outputs.

| Families | Draft absolute | Draft relative |
| --- | ---: | ---: |
| Coefficients, fitted, residuals, squared residuals, SSE, SST, residual SE, coefficient SE, t, expected, variance, NRA factor, adjusted expected, pre/post-NRA variance, threshold | 1e-9 | 1e-9 |
| R² | 1e-10 | 1e-9 |
| p-values | 1e-10 | 1e-9 |
| Degrees of freedom | 0 | 0 |
| Boolean significance | Exact | Not applicable |

These are review proposals consistent with the observed cache precision, not an acceptance verdict. Independently flag any zero-versus-nonzero p-value, unavailable value, sign change or changed classification regardless of numeric tolerance. Expected values from full native recalculation may justify tighter fixture-specific tolerances. Do not loosen them automatically to force a pass.

## Alternate-engine conversion evidence

Converted the three originals into separate `/tmp/energiepad-sprint4-recalc-20260923` outputs with LibreOfficeDev `26.8.0.0.alpha0`, build `2c87e51eeaa2b413ff4ae097b2705eea1995d8e5`. Original hashes remained unchanged. No formula error cells were observed within the inspected A1:M98 ranges. Multi F43 became `4.33964733546246E-014`, independently supporting the engine's nonzero probability.

**This conversion is not full native Excel recalculation evidence.** Some cached formulas remained unchanged (e.g. single J17/L17 and multi D33), while dependents recalculated from them. Consequently it cannot establish full recalculation correctness. No input-perturbation/restore test in Excel was performed. Local conversion comparison reports preserve original/output hashes and cell differences without approving results.

## Reproduce the original-cache comparison

From `apps/web`, using Node 22+ and Python 3:

```sh
npm run sprint4:verify -- /path/to/workbooks /path/to/new-report.json
```

Set `SPRINT4_PYTHON` if Python is not on PATH. The command fresh-extracts each recognized layout, computes from baseline/reporting **inputs** using the application engine, and compares against source cached outputs. Source outputs are never engine inputs. Reports are exclusive mode-0600 files. Exit **2 means acceptance remains blocked**, even when all comparisons are available; exit 1 means execution failed. No numerical pass is inferred without approved tolerances.

The current local report is `apps/web/.local/sprint4/verification-all-20260923.json`: 305 numeric comparisons and 36 matching significance flags. The report includes every address, expected/actual value and absolute difference; generated private evidence remains outside source control.

## Remaining acceptance work

Obtain reviewed full recalculation from the intended Excel version, recording version/build, date, source and output hashes, calculation mode, full-rebuild action, unchanged inputs and representative input-change/restore checks. Review the zero p-value and differing labels above; approve expected result cells, per-family tolerances, units and policies CD01–05/CD09–15. Then version the approved registry and executable golden pass/fail suite. Until that evidence and approval exist, application results remain UNVALIDATED and audit point 6 stays open.

## Review report command

Run `npm run sprint4:review -- /path/to/workbooks /path/to/new-review.md` from `apps/web` to fresh-extract all recognized original references and generate a readable review report. Output is an exclusive mode-0600 Markdown file; sources and existing reports are never overwritten. Exit 2 records the still-open acceptance gate; exit 1 means execution failed.

The report includes source hashes, algorithm versions, assumptions, coverage gaps, per-family draft limits, every numerical comparison and significance classification, and the pending evidence checklist. Differences and classification agreement are recomputed from the values. Zero/nonzero probabilities, opposite signs, unavailable/unrepresentable values and unknown result families remain flagged independently of the numerical tolerance. The command uses the draft contract above, not an approved tolerance or a golden acceptance result.

## Native evidence intake

Use the [native evidence instructions](SPRINT_4_NATIVE_EVIDENCE.md) and `sprint-4-native-evidence.template.json` to record separate recalculated copies and review evidence. `npm run sprint4:evidence -- <manifest.json> <new-report.json>` verifies hashes and checklist consistency without treating supplied attestations as proof or approval. The initial check confirms the three original hashes; native rebuild/review evidence remains missing.

## Executable numerical compatibility test

From `apps/web`:

```sh
npm run test:compatibility -- /path/to/workbooks /path/to/new-report.json
```

The command fresh-extracts all three hash-pinned workbooks, recomputes engine results, and checks the exact `(result family, cell address)` and significance-address sets registered in `workbook-cell-coverage-v1`. A missing/replaced cell cannot pass by keeping the same comparison count. Report order does not matter. Registry coverage is 82 Single, 91 Multi and 132 NRA numerical cells plus 12 significance cells per workbook.

Exit 0 means the registered numerical comparison passed under the user's absolute tolerance 0.99, with exact significance agreement. Exit 1 means a numerical/classification failure or command/input/output error. Exit 2 means missing, changed or incomplete reference coverage. Unlike the earlier review commands, this is a numerical pass/fail test, not an always-blocked review report. The output includes source identities, registry/policy versions, per-fixture status, failures and advisories. It does not relabel application snapshots or approve unrelated methodology/coverage.

Reports use mode 0600 and exclusive creation. The workbooks remain private external inputs and are not committed to the public repository. A runner must receive the reference directory explicitly; there is no silent skip or automatic download when fixtures are absent. Default `npm test` exercises the registry and failure modes with synthetic data; this separate command exercises the real workbooks.
