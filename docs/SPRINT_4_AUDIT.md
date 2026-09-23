# Sprint 4 completeness audit

Scope: master V2 specification, implementation plan, current analysis engine/service/UI, schema and test source. Includes the uncommitted regression-diagnostics changes. This is a static completeness review; no new tests or database mutations were performed. The previous increment recorded 136 passing unit tests and a passing expanded Chromium workflow.

Sprint 4 remains incomplete. The experimental engine, snapshots, authorization, history pagination and diagnostics are delivered, but workbook compatibility has not passed. Items below have stable numbers for follow-up; implementation fixes come first, while item 6 is the mandatory acceptance blocker.

## 1. Saved baseline input warnings disappear from the normal view — fixed

`apps/web/src/components/analysis-workspace.tsx`: the selected baseline panel displays the fit and diagnostics but does not render `baseline.snapshot.assembly.warnings`. These warnings are shown in readiness or a reporting result instead. Loading a baseline alone after reload hides estimated-consumption warnings inside raw JSON; saving directly without readiness has the same problem.

Resolution: the selected baseline panel now renders its frozen input warnings independently of readiness and reporting runs. A browser regression scenario covers direct save without readiness, baseline-only history reload, and switching to a clean baseline without leaving stale warnings. See the acceptance follow-up for validation.

## 2. Archived sites lose access to saved analysis history — fixed

`apps/web/src/server/analysis/service.ts`, `access`: `archivedAt: null` applies to both writes and reads. Consequently `readBaseline`, `history`, `runHistory` and `readRun` all reject saved evidence once its site is archived, even for an otherwise authorized owner. Sprint 2's archive contract says audit/history remain available.

Resolution: historical reads now allow archived sites under unchanged tenant/membership/assignment checks. The analysis selector includes authorized archived sites with a history-only view; active options, readiness and new calculations remain blocked. Existing archival revocation of Site Manager assignments is preserved. See the acceptance follow-up for validation.

## 3. NRA assumptions and approval metadata are incomplete — fixed

The specification requires NRA assumptions, evidence, author, approval and model version. Current snapshots retain numerical evidence, reference-month choices, author and baseline/model linkage. `runDefinition` accepts only period/policy/reference mappings, and the schema has no NRA rationale or approval record. `UNVALIDATED` is a numerical compatibility state, not an NRA approval record.

Resolution: new NRA runs require rationale and evidence references. Independent Owner/Admin decisions are append-only, audited and tied to the exact run under `nra-review-v1`. Changed inputs/context require fresh review; legacy runs remain readable without automatic approval. Numerical compatibility remains UNVALIDATED. See the design and acceptance follow-up.

## 4. Statistical interpretation configuration is missing — fixed

The master specification includes p-value bands (≤0.01, ≤0.05, >0.05) and versioned R² verdict thresholds/wording. The diagnostics now display numeric statistics and unavailable states, but no versioned interpretation layer exists. CD12 and CD14 still record review decisions, including the workbook's strict versus specification-inclusive p boundaries.

Resolution: `statistical-interpretation-v1` follows specification-inclusive p bands and the verified NRA K41 R² thresholds. New baselines persist the complete provisional configuration and verdicts; UI reads saved labels only. Legacy baselines remain unlabelled, undefined states remain unavailable, and tests cover exact/adjacent boundaries and configuration isolation. Workbook compatibility acceptance is separate.

## 5. Persisted multi-driver workflows lack integration/browser coverage — fixed

The numerical unit suite exercises one-, two- and three-driver fits. The persisted analysis integration script creates single-population and single-HDD models; the browser workflow creates single-population models. There is no equivalent saved two-/three-driver weather workflow covering assembly order, reporting and reload.

Resolution: dedicated disposable-database and browser scenarios now cover both weather models, reordered/mixed driver assembly, known coefficients/predictions, pinned weather provenance, missing-input rejection and saved-result reloads. The integration suite is registered in `test:integration`. See acceptance evidence; approved workbook comparisons remain separate.

## 6. Mandatory workbook compatibility acceptance is still blocked

All three references are now supplied and hash-pinned. Read-only, independently computed cache characterization covers 305 numerical values and all 36 monthly significance flags agree. The new verification CLI records differences and remains fail-closed for acceptance. See [workbook review](SPRINT_4_WORKBOOK_REVIEW.md) for layouts, measured differences, proposed tolerances and discovered label/probability discrepancies.

Remaining: reviewed full native Excel recalculation, approved expected outputs, per-family tolerances and methodological decisions, followed by an approved golden registry/suite. LibreOffice conversion was additional evidence only; some cached dependencies were retained, so it is not a full recalculation approval. The withdrawn CD11 shifting-range claim is not a remaining defect. Application outputs remain experimental.

## Documentation follow-up

The implementation plan still describes Sprint 4 primarily as preparation, and the opening design status says results are not exposed even though the later workflow sections correctly describe the live experimental UI. Consolidate current status separately from historical evidence. This documentation cleanup does not close any acceptance gate.

Sprint 3 real-export reconciliation remains a separate outstanding item. Carbon/cost analytics, reports and targets remain Sprint 5 rather than missing Sprint 4 work.
