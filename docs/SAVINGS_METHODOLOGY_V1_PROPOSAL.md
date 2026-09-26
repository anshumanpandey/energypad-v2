# Savings methodology v1 — decision proposal

Status: PROPOSED, not approved or active. Prepared to resolve point 1 of PRE_SPRINT_7_REVIEW.md. Proposed policy identity: `savings-methodology-v1`.

## Decision requested

Approve the rules below for newly assessed savings evidence. This is a scoped product methodology decision, not certification that every site's regression assumptions hold. Existing immutable baselines, runs and reports retain their original status. The accepted workbook comparison tolerance remains absolute 0.99, relative 0, with exact significance classifications; user-confirmed recalculation remains accepted.

## Proposed rules

| Area | Exact proposed rule |
| --- | --- |
| Regression | Existing centered/scaled, column-pivoted QR with intercept and one to three declared drivers; residual degrees of freedom `n − k − 1`; residual standard error `sqrt(SSres / df)`. Pin the existing algorithm identity and exact inputs in each assessment. |
| Rank and missing inputs | Fix relative rank tolerance at `1e-10` for this policy. Block insufficient degrees of freedom, missing/nonfinite values, constant/dependent predictors and unrepresentable calculations. Preserve measured zero as zero. |
| Statistical labels (CD12) | Two-sided coefficient p-value ≤0.01: Very significant; ≤0.05: Significant; otherwise Not significant. Undefined/underflow probabilities remain unavailable, never rounded to zero. |
| Model-fit labels (CD14) | R² ≥0.90: Very strong; ≥0.80: Strong; ≥0.75: Acceptable; below 0.75: Unreliable. Undefined R² stays unavailable. Labels alone never approve savings. |
| Constant response and perfect fits (CD15) | Keep diagnostic results, but block verified-savings eligibility when R² or inference is unavailable or residual standard error is zero. Do not invent p-values or significance for a zero threshold. |
| Reporting variance | Expected minus actual: positive means saving; negative means waste. Preserve signed values and both pre- and post-NRA evidence. |
| NRA | NONE, HOURS, POPULATION or both as explicitly selected. Use exact baseline-reference/reporting month ratios, multiply both ratios when selected, and retain rationale/evidence and the existing independent NRA approval. Missing or zero reference denominators block the affected month. |
| Significance | Use absolute post-NRA variance ≥ twice baseline residual standard error, with inclusive equality. Do not scale that threshold by NRA. Zero threshold is undefined. This is the specified operational indicator, not a new confidence-interval claim. |
| Extrapolation and negative predictions | Block verification if predictors exceed their baseline observed ranges or predictions are negative. Never clip predictions. Exploratory warning-enabled runs remain available but ineligible under this policy. |
| Estimated consumption | Block verification using estimated baseline or reporting consumption. Exploratory results remain available. |
| Verification scope and completeness | Require complete saved reporting evidence for the opportunity's exact tenant/site/meter/baseline, a period wholly after the original investigation and a full month after implementation, completed action evidence, references, and current owner/admin approval. |
| Positive saving outcome | Require positive total post-NRA savings, R² ≥0.75 and available coefficient inference, with no blocked months or policy violations. Record monthly significance separately; do not describe the aggregate as statistically significant merely by summing monthly results. Zero/negative outcomes retain verification evidence but cannot be marked VERIFIED savings. |
| Carbon and cost | Optional impacts retain their own source/factor/currency compatibility rules. Their absence does not invalidate an otherwise eligible kWh saving, and never becomes a zero impact. |

The conservative eligibility restrictions above (R² threshold, complete inference, positive total and no estimated/extrapolated/negative-prediction inputs) are proposed product decisions. They are not inferred from the user's tolerance approval or claimed to be already enforced together.

## Activation work after approval

1. Record policy identity, exact rules/content fingerprint and the approval provenance in a server-owned registry. Request-supplied labels must never establish approval.
2. Add an immutable assessment linked to the exact saved baseline/report/run and policy identity. Reassess eligible historical evidence through a new record; never rewrite an old UNVALIDATED snapshot.
3. Have verification eligibility consume the trusted assessment and exact scoped evidence. Reject unknown algorithms, alternative policy settings, incomplete calculations, stale evidence and forged labels.
4. Replace the unconditional server and database blockers together with assessment-bound guards, preserving lineage, latest evidence, tenant constraints and audit atomicity. Keep unassessed evidence blocked.
5. Expose the approved policy, outcome and remaining limitations in the UI and retained exports. Preserve optional carbon identities.
6. Run positive detected → implemented → verification → VERIFIED database/browser acceptance plus role, tenant, stale-evidence, retry, audit rollback, direct database bypass and immutable-history tests. Numerical fixtures and supplemental edge tests must pass before activation is claimed complete.

## Existing evidence and limits

Existing regression, inference, reporting and interpretation tests exercise the numerical kernel, boundary labels and configurable edge behavior. They do not test the proposed complete eligibility conjunction or a positive VERIFIED path. Existing opportunity verification tests confirm the unconditional blocker, including resistance to forged VALIDATED labels. The accepted workbook record covers 305 numeric cells and 36 exact significance classifications; it does not certify assumptions for individual customer datasets.

Approval of this proposal authorizes implementation of the activation work; it does not itself mark historical evidence validated, migrate a production database or certify a deployment.
