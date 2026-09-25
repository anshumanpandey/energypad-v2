# Sprint 4 native Excel evidence intake

Current decision update, 24 September 2026: the user approved **0.99 absolute difference**, with relative tolerance **0**, and confirmed that all three supplied workbooks have been fully recalculated. These resolve the earlier ambiguous-tolerance and user-confirmation requests below. Recalculation is recorded as user-attested; no Excel version/build or execution log is fabricated. Fresh comparison passes all 305 numerical values and all 36 significance decisions. Methodology/coverage approval remains separate from this numerical agreement.

The checker records file identity and reviewer-supplied evidence for all three reference workbooks. It does not run Excel or certify the supplied claims. Numerical compatibility remains blocked until independent review, expected-output and methodology approval, explicit tolerances, and the golden acceptance suite are complete.

Copy `sprint-4-native-evidence.template.json` into a private working directory. Paths in the manifest resolve relative to that manifest; absolute paths also work. Keep the original hash-pinned files unchanged. Use separate recalculated copies and record their SHA-256 values.

From `apps/web`:

```sh
npm run sprint4:evidence -- /path/to/manifest.json /path/to/new-report.json
```

Reports are exclusive mode-0600 JSON files. Existing reports and source files are never overwritten. Exit 2 means compatibility acceptance remains blocked, even if the evidence checklist is complete. Exit 1 means invalid input or an execution failure. Missing individual files are recorded as checklist issues.

## Required fields per fixture

- `original`: source file and recorded SHA-256 from the template.
- `recalculated`: separate Excel-recalculated file and SHA-256; leave null until supplied.
- `excel`: version, build, Windows/macOS platform, `calculationMode: "automatic"`, `fullRebuildPerformed: true`, and `performedAt` as an ISO timestamp with timezone. Record what was actually done, not intended actions.
- `review`: reviewer, ISO `reviewedAt`, `unchangedInputsConfirmed: true`, and an `evidence` file/hash reference. That evidence should describe the full rebuild, workbook inputs and formulas inspected, dependent outputs, observed changes and restoration. It can include logs/screenshots or a review document. The checker verifies its hash but does not interpret or approve its contents.
- `perturbationChecks`: representative recorded input changes on `Regression Analysis`, with `inputCell`, `outputCell`, numeric `originalInput`, `changedInput`, `originalOutput`, `changedOutput`, `restoredOutput`, explicit `restorationAbsoluteTolerance`, and `originalInputRestored: true`. Both input and dependent output must change; restored output must match the original within the recorded restoration tolerance. Restoration tolerance is evidence for that check only, not the pending numerical compatibility tolerance.

The schema is defined in `apps/web/src/server/analysis/native-evidence.ts`. Null records and empty check arrays in the template are deliberate pending states. Do not populate them with guessed metadata. A workbook conversion using another spreadsheet engine is not native Excel evidence.

## Remaining decisions

The user's proposed tolerance “0.99” still needs an explicit absolute/relative/percentage definition. This intake tool does not interpret it. Approval of saved expected results, units, calendar/driver mapping, p-value boundaries, R² labels, and the Multi F43 zero-probability discrepancy remain separate decisions. Existing application outputs remain UNVALIDATED.
