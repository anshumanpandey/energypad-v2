# NRA reference evidence review — 22 September 2026

Status: source evidence extracted, not an approved golden fixture. Original workbook unchanged.

## Reproducible extraction

Run from the repository root with Python 3 (standard library only):

```sh
python3 scripts/extract_nra_evidence.py "/path/to/Multi Routine Adjustment Plus NRA V2.xlsx" /path/to/new-evidence.json
python3 -m unittest discover -s scripts -p test_nra_evidence.py
```

The extractor pins the discovery SHA-256 `427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed` and the `Regression Analysis` layout. A changed workbook fails before output; review its layout and add a separately versioned extraction contract rather than bypassing the hash. Compressed and expanded data are bounded at 20 MB, worksheet relationships are resolved explicitly, duplicate archive entries and XML entity declarations are rejected, and no macros/external links are executed or followed. No worksheet is resaved or recalculated.

Output is an exclusive, mode-0600 JSON file. Raw numerical text, original formula text/attributes, cell addresses, resolved labels and style indices are preserved for these ranges:

| Section | Source range |
| --- | --- |
| Baseline labels, drivers and consumption | A5:M9 |
| Coefficient labels and cached values | A28:D29 |
| Fitted values and residuals | A34:M38 |
| Summary statistics | A40:M44 |
| Coefficient tests | A48:M52 |
| Reporting inputs and outputs | A57:M66 |
| Operating hours | A70:M72 |
| Population | A75:M77 |
| NRA | A80:M84 |
| Significance | A89:M96 |

The current local report is `apps/web/.local/sprint4/nra-source-evidence.json`, outside tracked source control. It contains 494 populated evidence cells. Dates/period labels and driver units remain source evidence, not inferred calendar-month or methodology approval. Cached values remain explicitly distinct from raw formulas; the script does not translate shared formulas or evaluate arbitrary expressions.

## Correction to CD11

The prior discovery audit incorrectly described C38:M38 as shifting the mean range. Direct ZIP/XML inspection of the unchanged workbook shows twelve independent formulas, from `(B9-AVERAGE(B9:M9))^2` to `(M9-AVERAGE(B9:M9))^2`. All use B9:M9 and have no shared-formula attributes. The previously reported shifting-range SStot/R² values do not describe this file and are withdrawn.

The extractor checks the exact formula shape before computing a targeted diagnostic. If the formula shape is unrecognized it records that fact instead of inventing an interpretation.

| Diagnostic | Value |
| --- | --- |
| SStot from original B9:M9 inputs using Decimal arithmetic | 105.666666666666666… |
| Stored D41 SStot | 105.66666666666666 |
| Difference | about 6.67e-15 |
| R² from that SStot and summed cached B37:M37 squared residuals | 0.419691136917555608… |
| Stored G41 R² | 0.41969113691755555 |
| Difference | about 5.89e-17 |

These differences are reported without declaring an approved tolerance. The R² diagnostic uses cached residuals; it is not an independent full least-squares fit or native Excel recalculation. The unrelated historical formula-policy decisions, p-value/significance boundaries and numerical edge cases remain under review.

## Remaining acceptance evidence

- Supply the single- and multi-driver reference workbooks, with source provenance and layout review.
- Verify units, driver order, period interpretation, NRA basis and expected cell/array results for each reference.
- Record native recalculation evidence. Preserve the original file and hash if a new version is issued.
- Record approved numerical tolerances and methodology policies before accepting engine compatibility.

The latest availability report is `sprint-4-fixture-readiness-verified.json`. The earlier `sprint-4-fixture-readiness.json` is retained as historical evidence and contains the now-withdrawn CD11 blocker; it is superseded for current readiness.
