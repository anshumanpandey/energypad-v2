# Production reconciliation record

Status: AWAITING SOURCE IDENTIFICATION. This record prepares point 3 of PRE_SPRINT_7_REVIEW.md; it is not production reconciliation approval. No production export, target workspace or mapping decisions have been identified for this run.

## Required intake

Provide the restricted local paths to the EnergiePad export and schema, the export's source system/environment and extraction time, intended scope (sites and periods), and target V2 organisation ID. Identify the existing verified Owner/Admin actor for target preflight. Do not use passwords, API keys, unrelated SQL backups or synthetic fixtures as migration evidence.

Record each original file's SHA-256 and byte size before transformation. Preserve originals separately; the adapter's sanitized source hash excludes unknown columns and does not replace the original-file hash. If the export exceeds adapter bounds, partition it with an explicit manifest accounting for every original row and preserving dependency mappings. Both input files are bounded to 2 MB; energy accepts up to 500 rows per table and tariffs up to 2,000 rows per table. Confirm each adapter's schema before preparing bundles. Do not truncate exports to fit a batch.

## Review decisions before preview

- Identity: source site/fuel/end-use relationships and destination IDs/codes; every meter-list token mapped exactly once. Do not merge source sites or allocate consumption among meters implicitly.
- Dates: explicit reading month, interval interpretation and original timezone/timestamp evidence.
- Quantities: original decimal strings, units, conversion versions and source-factor semantics. Preserve missing separately from zero.
- Costs: currency, NET/GROSS, VAT PERCENT/FRACTION, rate scale and reasons for accepted differences. Do not reuse the 0.99 regression tolerance for migration reconciliation.
- Drivers: retain-only versus monthly population/hours, conflict/reuse decisions and original values.
- Tariff bands: reviewed weekdays, same-day start/end, validity periods and timezone; no inferred overnight splitting.
- Exclusions: enumerate unsupported tables/rows and their destination or explicit exclusion decision. Occupancy, patterns and logs use separate reviewed workbook workflows; tariff/energy reports alone do not certify all legacy tables.

## Dry-run execution

Use the documented preview commands from apps/web, after confirming the target database identity and actor. Replace every placeholder with reviewed values; these are templates, not ready commands.

```sh
npm run migration:preview:tariffs -- <organisation-id> <owner-or-admin-id> <tariff-bundle.json> <new-tariff-report.json>
npm run migration:preview:energy -- <organisation-id> <owner-or-admin-id> <energy-bundle.json> <new-energy-report.json>
```

Both previews are read-only and create exclusive private report files. Exit 0 means no detected blockers, not reviewer acceptance; 2 means a report with blockers; 1 means invalid input/access/file/connection error. Do not proceed to apply as part of this dry run. Catalogues, meters and conversions required by energy preview must already be registered in the intended target; unresolved dependencies must be reported, not invented.

## Evidence to fill after receiving sources

| Evidence | Current value |
| --- | --- |
| Original export/schema paths, hashes and extraction scope | Awaiting source |
| Target database identity, organisation and actor | Awaiting selection |
| Reviewed decision bundle paths/hashes | Awaiting decisions |
| Expected source table counts from original export | Not measured |
| Mapped/unmapped/excluded counts by table and batch | Not measured |
| Every source row accounted for once across batches | Not checked |
| Quantity totals by site/meter/period/source unit | Not measured |
| Net/VAT/gross totals by currency and cost basis, with null counters | Not measured |
| All differences, conversion/rounding effects and reviewer disposition | Not reviewed |
| Duplicate/dangling identities and unresolved blockers | Not checked |
| Immutable source-to-target receipts after separately authorized apply | Not applicable to preview |
| Reviewer identity/date and explicit acceptance | Pending |

Do not sum incompatible units/currencies, tariff rates or meter mappings. A blocked energy report's totals cover only prepared rows; compare its coverage before drawing conclusions. A ready preview is target-state-specific. Any later apply must revalidate the exact reviewed input and target state and retain its receipt; production rollback/backup/cutover acceptance remains Sprint 8.

## Completion criteria

Point 3 closes only when the real original source is identified and preserved, reviewed mappings cover the agreed scope, dry-run counts/totals reconcile to independently measured original-export values, and discrepancies/exclusions are explicitly accepted. Synthetic adapter tests establish implementation behavior only. No counts, approval or production readiness may be inferred from this template.

Validation on 26 September 2026: legacy tariff preview integration, tariff apply integration and energy migration integration all passed against isolated synthetic databases. Coverage includes read-only preflight, CLI exits/private output, scoped authorization, source hashes and stale targets, decimal/tax/driver decisions, rollback, concurrent retries and immutable provenance/receipts. These results do not fill the real-source evidence fields above. No application code or production data was changed.
