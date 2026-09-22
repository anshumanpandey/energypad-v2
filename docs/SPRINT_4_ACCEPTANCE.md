# Sprint 4 preparation evidence — 22 September 2026

Status: preparation delivered; numerical compatibility is not accepted. Sprint 3 real-export reconciliation remains open independently.

Delivered a read-only fixture availability/integrity command and the engine input/result, persistence and service design in SPRINT_4_DESIGN.md. No regression engine, database migration, analytical endpoint or UI calculation was introduced.

The real-directory check recorded in sprint-4-fixture-readiness.json exited 2 as designed: the single- and multi-driver references are missing, and the NRA source matches its prior discovery hash. Expected results, corrected/reviewed NRA formula evidence, numerical tolerances and calculation policies remain unresolved. Matching bytes alone never imply approval.

Verification:

- 49 unit tests across 16 files passed. New tests cover missing references, non-file paths, changed source hashes, read-only preservation and the inability of arbitrary fixture bytes to imply acceptance.
- TypeScript and targeted ESLint passed.
- The CLI wrote the real-source metadata report with private permissions and refused a repeated output filename without changing it.
- No database or external provider was accessed; existing local preview remained running. Workbook formulas/cached values were not recalculated or altered.

Next dependent slice: obtain and review the missing single/multi references, resolve the NRA formula/cache discrepancy and record approved expected results, policies and tolerances before accepting numerical compatibility. The proposed architecture remains reviewable preparation, not approval of those decisions.
