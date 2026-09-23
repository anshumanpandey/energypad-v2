# Experimental regression kernel

The first numerical slice is implemented in `apps/web/src/domain/analysis/regression.ts`. `fitRegression(unknown)` fits an intercept and one to three driver columns, returning either `FITTED` or a typed `BLOCKED` state. Every result carries `compatibility: UNVALIDATED` and algorithm version `ols-qr-experimental-v3`. The authorized AnalysisService now invokes the kernel for the experimental Advanced Analysis workflow.

## Inputs and outputs

Inputs contain a response unit, ordered driver codes/units, uniquely identified observations with finite response/driver numbers, and an explicit numerical-policy version and relative rank tolerance. The kernel supports 1–2400 observations, requires more observations than fitted parameters and rejects duplicate IDs, duplicate driver codes, missing values and mismatched driver vectors. It does not infer period, organisation/site/meter scope, unit conversion or baseline membership; a later authorized input assembler must establish those properties.

Outputs include ordered coefficients with observed predictor ranges and intercept, the centering values, fitted values/residuals keyed by the original row IDs, sample size, rank, residual degrees of freedom, SSres, SStot, R², residual standard error and coefficient inference. Residual is actual minus fitted; this is a regression diagnostic, not the later expected-minus-actual saving/waste measure. Original row order is retained in the output; fitting uses a stable ID order so merely shuffling input rows does not change summation order.

Constant response is retained with R² null and a CONSTANT_RESPONSE warning. Constant or linearly dependent drivers block fitting. Negative predictions are returned with a warning, not clipped. Overflow/unrepresentable quantities return NUMERICAL_RANGE rather than NaN/Infinity. No rounding is applied to claim compatibility or force an exact fit. Inputs are not mutated.

## Numerical method and provisional choices

Predictors and responses are centered. Predictor columns are normalized by their centered Euclidean norm, then fitted with column-pivoted Householder QR and back substitution; coefficients are unpermuted and rescaled to source driver units. The centered model is retained for stable future prediction where driver offsets are large. The rank threshold is relative to the first pivot in the scaled matrix. QR with column pivoting is a standard approach for least-squares problems where rank is in doubt; rank determination still requires an explicit numerical criterion. See the [LAPACK Users’ Guide](https://www.netlib.org/lapack/lug/node42.html).

Residual degrees of freedom are `n − k − 1`, including the intercept. Residual standard error is `sqrt(SSres / df)`; this follows the least-squares residual standard-deviation definition with one parameter per coefficient, including the intercept. See the [NIST least-squares reference](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm).

Caller-supplied policy labels do not constitute methodology approval. The API constrains rank tolerance to a finite value between ten machine epsilons and 0.01; tests use 1e-10 as a provisional engineering threshold. Constant-response/null-R², negative-prediction reporting and numerical edge handling are experimental behaviours to review under CD15. Synthetic test tolerances are engineering assertions, not approved workbook tolerances.

## Verification and boundaries

The regression tests cover independent one-driver noisy algebra, two/three-driver factorial designs, a nonorthogonal noisy exact-rational reference, row/column reordering, coefficient identity after pivoting, driver scaling and large offsets, constant/zero response, negative fits, duplicate IDs, missing/nonfinite inputs, insufficient degrees of freedom, exact/near collinearity and overflow/underflow.

`tests/fixtures/regression-rational.json` retains the raw synthetic matrix, exact coefficient fractions and expected numerical results. It was independently solved with Python Fraction Gaussian elimination of the normal equations, not by the TypeScript QR implementation. It is not a workbook fixture.

Read-only characterization against the previously extracted NRA source (SHA-256 `427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed`) found:

| Compared cached quantity | Observed difference, engine minus cache |
| --- | --- |
| Intercept | 0 |
| Largest absolute driver-coefficient difference | 7.78e-16 |
| SSres | −5.69e-14 |
| SStot | 0 |
| R² | 5.56e-16 |
| Residual standard error, df = 8 | −1.34e-15 |

These are characterization observations, not an approved pass/fail tolerance. The source workbook was not recalculated or resaved.

Remaining integration work: approved fixture/tolerance registry, scope-aware persisted input assembly, immutable baselines/runs, and analysis UI. Numerical workbook acceptance and Sprint 3 real-source reconciliation remain open.


## Coefficient inference slice

Algorithm v2 now returns `inference` containing the coefficient covariance matrix (intercept first, then declared driver order), standard errors, signed t-statistics and two-sided Student-t probabilities. Covariance is reconstructed from the fitted triangular QR factor, unpermuted and rescaled; the intercept incorporates predictor means and its cross-covariances. It does not form or invert the floating-point normal equations. Classical OLS standard errors assume the corresponding independent, equal-variance error model; this module does not establish that an energy dataset satisfies those assumptions.

The probability calculation uses the regularized incomplete beta function with integer residual degrees of freedom (1–2398), a log-domain prefactor, symmetry and a bounded continued fraction. Half-integer beta normalizers use recurrence rather than a new dependency. The df=1 case uses the analytic Cauchy tail. Definitions/recurrences are documented by [NIST DLMF §8.17](https://dlmf.nist.gov/8.17); the [SciPy Student-t CDF reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.stdtr.html) supplies an additional published spot-check. No significance threshold or p-value label is assigned.

Undefined cases remain explicit:

- Exactly zero residual variance gives zero standard errors/covariance and null t/p with ZERO_RESIDUAL_VARIANCE. No infinity is serialized and no perfect-fit significance is invented.
- Covariance overflow/underflow returns an inference NUMERICAL_RANGE state while preserving the otherwise finite fit.
- A t-statistic overflow gives null t/p with T_OVERFLOW.
- Probability underflow retains the finite log probability and returns null probability with UNDERFLOW, not an exact zero.
- Unsupported df/nonfinite inputs, fraction nonconvergence and numerical failures have distinct probability states. Individual probability status must be inspected even when covariance is AVAILABLE.

`tests/fixtures/inference-reference.json` contains synthetic covariance from exact Fraction inversion and 42 Student-t reference points computed independently using adaptive Simpson integration of the transformed density. Reproduce it to a new file with `python3 scripts/build_inference_reference.py /path/to/new-reference.json`; the generator uses Python's standard library and refuses an existing output. These engineering test tolerances are not approved workbook tolerances.

Read-only characterization against the same extracted NRA reference, comparing intercept/HDD/CDD/daylight with cached C49:F52, observed maximum absolute differences of about 1.34e-15 for standard errors, 5.33e-15 for t-statistics and 1.12e-15 for p-values. Driver order was mapped explicitly (intercept is source row 52). No native recalculation or workbook approval is inferred from that comparison.


## Reporting, NRA and significance slice

`src/domain/analysis/reporting.ts` now exposes pure `calculateReporting(unknown)` and `projectReportingModel(fit)`. Reporting algorithm `energy-reporting-experimental-v1` accepts the kWh projection of regression v3. Every result remains UNVALIDATED. The authorized AnalysisService invokes these modules and stores their results for Advanced Analysis.

Reporting requires a baseline ID, organisation/site/meter/end-use scope, explicit baseline/reporting periods (at most 120 months each), predictor source IDs and units, actual consumption, and versioned policy. Predictor columns align by code; all observations must match their declared site and month. Consumption must match the full meter/end-use scope. Duplicate months, contradictory source revision IDs, mismatched scopes and out-of-period evidence block the report. These consistency checks do not establish authorization or prove the caller supplied a real persisted baseline; the future authorized assembler must do that.

Predictions use the centered model. Pre-NRA savings/waste equals expected minus actual. NRA can explicitly select no adjustment, operating hours, population, or both. Each reporting row declares its baseline reference month; ratios join by kind and month, never array position. The selected reporting/reference ratios multiply expected consumption; post-NRA savings/waste equals adjusted expected minus actual. Zero reporting values remain valid; zero denominators and missing values block the affected month. Calendar-month operating hours and observation units are validated.

Significance requires explicit PRE_NRA/POST_NRA and AT_LEAST/GREATER_THAN policies against twice baseline residual standard error. The threshold is not rescaled by NRA. Zero-threshold handling is explicitly UNDEFINED or COMPARE_NONZERO; zero variance is never labeled significant. Direction uses post-NRA savings/waste, independently of significance basis. These are experimental caller-selected policies, not methodology approval or a general statistical prediction interval.

Extrapolation and negative predictions each require BLOCK or ALLOW_WITH_WARNING. Extrapolation checks each predictor's observed minimum/maximum only; it is not a multivariate hull or leverage diagnostic. Missing months remain blocked rows in an INCOMPLETE result; no totals or zero-filled estimates are produced. Successful/incomplete results include a cloned input snapshot with source IDs and policies. This is evidence for a future immutable persisted run, not persistence itself. Numerical overflow/ratio underflow is blocked.

Eighteen reporting tests cover month/code joins, ratios, zero/missing values, scope/source conflicts, units, calendar limits, both significance boundaries and bases, negative predictions, extrapolation and numerical failures. Read-only characterization of all 12 reporting months in the available NRA source found maximum absolute differences of 2.14e-14 kWh for expected/adjusted expected/final variance, identical adjustment factors, and 12/12 matching cached significance flags. Years 2022/2023 follow source row labels; IDs/scopes are synthetic harness values. Cached results were not natively recalculated and are not approved golden fixtures.

Authorized persisted input assembly and baseline/run snapshots are now implemented in the internal AnalysisService; see SPRINT_4_DESIGN.md. UNVALIDATED status remains enforced until fixture and methodology gates are satisfied. Missing reference workbooks, native recalculation, approved tolerances/policies and analysis UI remain open.
