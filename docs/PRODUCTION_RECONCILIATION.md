# Production reconciliation record

Status: AWAITING SOURCE IDENTIFICATION. This record prepares point 3 of PRE_SPRINT_7_REVIEW.md; it is not production reconciliation approval. No production export, target workspace or mapping decisions have been identified for this run.

## Required intake

Provide the restricted local paths to the EnergiePad export and schema, the export's source system/environment and extraction time, intended scope (sites and periods), and target V2 organisation ID. Identify the existing verified Owner/Admin actor for target preflight. Do not use passwords, API keys, unrelated SQL backups or synthetic fixtures as migration evidence.

Record each original file's SHA-256 and byte size before transformation. Preserve originals separately; the adapter's sanitized source hash excludes unknown columns and does not replace the original-file hash. If the export exceeds adapter bounds, partition it with an explicit manifest accounting for every original row and preserving dependency mappings. Both input files are bounded to 2 MB; energy accepts up to 500 rows per table and tariffs up to 2,000 rows per table. Confirm each adapter's schema before preparing bundles. Do not truncate exports to fit a batch.

## Original-file intake command

`scripts/migration/source-manifest.py` records the original-file hashes independently from adapter sanitization. Copy `docs/source-intake.template.json` into a private review directory and replace every placeholder with the verified source description, extraction timestamp including timezone, intended site/period scope, target workspace UUID and absolute original-file paths. Supply at least one export and one schema, with unique labels; maximum 100 files. Extraction time must not be in the future. The tool validates metadata syntax, not the truth of the operator's statements or access to the target.

From the repository root:

```sh
python3 -B scripts/migration/source-manifest.py --request /private/review/intake.json --output /private/review/source-manifest.json
```

Prepare the review directory with mode 0700 before running. The command requires Python 3.11 or later, reads a request of at most 64 KiB, and streams full source files without truncating them. It makes no database, provider or network calls and does not parse source contents. It rejects empty/nonregular sources, final-component symlinks and duplicate file identities (including hard links). It checks descriptor/path size, identity and modification/change times across each hash and fails if it detects a changing file. Keep originals quiescent and separately preserved; this is not a transactionally consistent snapshot across multiple files or protection against a privileged actor restoring metadata. Paths with symlinked parent directories must be controlled by the operator.

The versioned manifest records supplied source/scope/target identity, normalized extraction time, absolute file paths, labels, roles, full byte sizes and SHA-256 hashes. It is written mode 0600, published only after completion and never overwrites an existing output, including a symlink. An existing output requires choosing a new evidence path; do not replace the previous record. On errors, stderr uses a fixed message rather than echoing source paths or contents. Exit 0 confirms publication; exit 1 means evidence was not confirmed; command-line usage errors exit 2. If a filesystem sync fails after publication, the complete output may exist even though the command reports failure; inspect it privately and do not assume confirmed durability.

The manifest explicitly sets `sourceIdentityVerified` and `reconciliationApproved` to false. Original rows are never embedded. It is metadata, not a backup, mapping review, partition coverage report, target authorization check or reconciliation verdict. Preserve the original files and manifest privately; do not commit customer-source paths or identifiers. Provide those restricted paths for the separately reviewed adapter preparation and reconciliation work. No real source has been supplied or hashed by adding this tool.

## Verify preserved originals before review

Recheck the preserved originals against the intake manifest before preparing adapter inputs and again before accepting reviewed evidence:

```sh
python3 -B scripts/migration/source-manifest.py --verify /private/review/source-manifest.json
```

Verification reads only; it cannot be combined with `--output`, does not update the manifest, and never repairs files or refreshes expected hashes. The manifest must be a regular nonsymlink file, at most 1 MiB, with the exact version-1 contract. Duplicate JSON keys, invalid evidence types/hashes, unsupported versions, inconsistent/future timestamps, missing export/schema roles and altered approval flags fail before any referenced file is opened. Only use a manifest from your trusted private evidence store, since it selects the paths to read.

The command streams every original and compares both byte size and SHA-256, reusing the intake checks for regular files, symlinks, duplicate identities and changes while hashing. It reports zero-based file indexes in manifest order and fixed statuses; no source labels, paths, raw contents or expected file hashes are echoed. A missing/unreadable/nonregular or changing file is `UNAVAILABLE_OR_UNSTABLE`; a different size or hash is `CHANGED`; reuse of a file identity is `DUPLICATE_SOURCE`. Check the private manifest to locate the affected entry. It continues across individual file failures so all entries receive a result.

| Exit | Overall status                  | Meaning                                                                                                                   |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0    | MATCHED                         | Every file matched the supplied manifest during this run.                                                                 |
| 1    | ATTENTION                       | At least one file changed, could not be verified or duplicated another source. Stop evidence preparation and investigate. |
| 2    | INVALID_OR_UNAVAILABLE_MANIFEST | The manifest could not be read or validated. CLI usage errors also exit 2.                                                |

Successful manifest validation also produces `manifestSha256`, binding the result to the exact manifest bytes, plus `checkedAt`. Preserve the result privately with review evidence if needed. A manifest is not signed: changing both the originals and manifest can produce MATCHED. Independently preserve and trust the original manifest; a self-consistent hash check does not establish source authenticity, correct scope, target permissions, mappings, reconciliation or cutover approval. Both approval flags remain false, and cross-file snapshot limitations still apply. Do not regenerate a manifest over changed sources merely to clear an unexpected mismatch; retain the original evidence and review the extraction change.

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

| Evidence                                                              | Current value             |
| --------------------------------------------------------------------- | ------------------------- |
| Original export/schema paths, hashes and extraction scope             | Awaiting source           |
| Target database identity, organisation and actor                      | Awaiting selection        |
| Reviewed decision bundle paths/hashes                                 | Awaiting decisions        |
| Expected source table counts from original export                     | Not measured              |
| Mapped/unmapped/excluded counts by table and batch                    | Not measured              |
| Every source row accounted for once across batches                    | Not checked               |
| Quantity totals by site/meter/period/source unit                      | Not measured              |
| Net/VAT/gross totals by currency and cost basis, with null counters   | Not measured              |
| All differences, conversion/rounding effects and reviewer disposition | Not reviewed              |
| Duplicate/dangling identities and unresolved blockers                 | Not checked               |
| Immutable source-to-target receipts after separately authorized apply | Not applicable to preview |
| Reviewer identity/date and explicit acceptance                        | Pending                   |

Do not sum incompatible units/currencies, tariff rates or meter mappings. A blocked energy report's totals cover only prepared rows; compare its coverage before drawing conclusions. A ready preview is target-state-specific. Any later apply must revalidate the exact reviewed input and target state and retain its receipt; production rollback/backup/cutover acceptance remains Sprint 8.

## Completion criteria

Point 3 closes only when the real original source is identified and preserved, reviewed mappings cover the agreed scope, dry-run counts/totals reconcile to independently measured original-export values, and discrepancies/exclusions are explicitly accepted. Synthetic adapter tests establish implementation behavior only. No counts, approval or production readiness may be inferred from this template.

Validation on 26 September 2026: legacy tariff preview integration, tariff apply integration and energy migration integration all passed against isolated synthetic databases. Coverage includes read-only preflight, CLI exits/private output, scoped authorization, source hashes and stale targets, decimal/tax/driver decisions, rollback, concurrent retries and immutable provenance/receipts. These results do not fill the real-source evidence fields above. No application code or production data was changed.
