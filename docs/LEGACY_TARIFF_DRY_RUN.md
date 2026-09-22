# Legacy catalog and tariff dry run

Sprint 3 provides a read-only preview command and a separate explicit atomic apply command. Preview does not approve or import a mapping. Apply requires the reviewed source/report and current Owner/Admin access. Final reconciliation against a real source export remains open.

## Evidence needed to close audit point 5

The synthetic fixture establishes adapter behavior, not source parity. Close the real-source reconciliation gate only when the following evidence is recorded:

1. Identify the restricted export, source namespace and extraction scope/date. Include all six supported tables, or explicitly record why a table has no rows. Preserve the original export separately from the sanitized bundle.
2. Reconcile exported row counts and source identities against the bundle for each table. A ready preview alone cannot detect rows omitted before it receives the bundle.
3. Record reviewed site mappings and fuel/end-use codes, plus the tariff validity dates, timezone, rate unit, tax inclusion, VAT scale, rate scale and weekday/time interpretation. Unknown semantics remain blockers.
4. Run the read-only target preview and retain its report. Resolve every unmapped row, source issue and target conflict. Record whether the export actually contains association aliases or identities already represented by independently created destination records; these currently block apply and require a separately reviewed mapping approach.
5. Record the reviewer and evidence reference alongside the bundle/report. Reconcile each original band with its planned rate, days and times, and each pricing row with its planned VAT and tax basis. Do not sum unrelated rates or currencies.

This evidence can be prepared without applying records to the user workspace. Production cutover remains Sprint 8. A source-dependent blocker must remain open rather than being replaced by another synthetic test or guessed mapping.

## Run

From apps/web, with its configured DATABASE_URL:

```sh
npm run migration:preview:tariffs -- <organisation-uuid> <verified-owner-or-admin-user-uuid> <bundle.json> <new-report.json>
```

This is a trusted local/operator command, not an HTTP endpoint. The user UUID must have current verified Owner/Admin membership in the organisation. Every target site must be active and owned by that organisation. Supply a new report filename; an existing file is never overwritten.

The source JSON is limited to 2 MB and 1–2000 total rows across these six tables:

- FuelSources: id, source, colorCode.
- FuelUses: id, use, fuelSourceId.
- BusinessFuelUses and UsedInToFuelSourceToSite: id, siteId, fuelSourceId, usedInId.
- BusinessFuelsPricing: id, siteId, fuelSourceId, usedInId, currencyCode, vat.
- BusinessBrands: id, siteId, fuelSourceId, usedInId, name, startTime, endTime, rate, days.

Missing tables can be omitted; unsupported table names are rejected. Unknown columns within supported rows are discarded, including credentials; they never enter the ledger, plan or input hash. IDs are retained as strings, including ULIDs. Unsafe numeric IDs are rejected. Export decimal money and tax values as strings to avoid precision loss before the tool receives them.

Use [the synthetic bundle](../apps/web/tests/fixtures/legacy-tariffs.json) as the format example. Replace its placeholder target site UUID and review every decision. Its test data, dates, rates, VAT and location are not defaults for real exports.

## Decisions required

The bundle contains source (a source-system namespace), reference (review evidence), tables and decisions:

| Decision array | Required values |
| --- | --- |
| sites | legacyId, targetSiteId; one-to-one site mapping |
| fuels | legacyId, stable code, supported fuel code; optional reviewed hex colour override |
| endUses | legacyId, stable code, reviewed hex colour |
| associations | source table, legacyId, site-use code |
| tariffs | pricing legacyId, firstDay/lastDay inclusive, timezone, rateUnit, taxBasis NET/GROSS, vatBasis PERCENT/FRACTION, rateScale MAJOR/HUNDREDTH, bands |
| tariff bands | source band legacyId, ISO weekdays 1–7, reviewed startTime/endTime |

No weekday convention, overnight split, validity date, timezone, tax inclusion or rate scale is inferred. Raw band day/time text is retained in the ledger alongside the explicit normalized decisions. Times must be same-day and end-exclusive, with 24:00 allowed only as an end. Overnight source bands require prior review/splitting; this adapter does not fabricate extra source rows.

FRACTION multiplies source VAT by 100; PERCENT leaves it unchanged. HUNDREDTH divides a source rate by 100; MAJOR leaves it unchanged. These are explicit choices, not automatic currency rules. Other scales or unresolved semantics block migration and need further reviewed support. Conversion uses decimal arithmetic without rounding to force acceptance; excess precision fails V2 validation. Zero remains zero.

A source band must belong to the pricing row's same source site/fuel/end-use association. Bands cannot be reused across pricing rows in this bounded adapter. Source aliases that would collapse two association rows to one V2 use are blocked for review rather than silently merged.

## Report and reconciliation

The output has:

- adapter version, source namespace, sanitized-input/decision hash and target organisation/check time;
- a ledger retaining allowlisted original fields for valid source rows, with logical destination keys;
- proposed catalog inputs, site uses referencing catalog keys, and tariff inputs referencing site-use keys;
- source, mapped and unmapped counts for each table;
- actionable source issue codes and target conflict codes;
- ready, which means only that this particular dry run has no detected blockers.

Logical keys are source-table/ID pairs, not generated V2 UUIDs. Proposed payloads are a review plan, not a directly executable bulk mutation API. Malformed source rows are counted as unmapped and identified by source row position; invalid/unknown fields are not copied to the ledger.

Existing target codes/source identities are conflicts even if they look equivalent. Apply only reuses an identical previously committed batch receipt; independently created matching records remain conflicts. No sums are produced across incomparable tariff rates or currencies.

Database checks run in a repeatable-read, read-only transaction. No domain or audit rows are created. Reports are created with mode 0600 and exclusive file creation. The source database is never opened. Exit codes are 0 for ready for review, 2 for a written report with blockers, and 1 for invalid format, permissions, size, connection or output errors.

The hash excludes discarded unknown columns. It is not an approval token or a guarantee that the target remains unchanged: an eventual commit must revalidate permissions, site status, dependencies, source content and target state.

## Scope boundaries

This milestone supplies the preview adapter, target preflight and atomic apply for the six tables above. It does not cover BusinessFuelsSize meter-list allocation, legacy consumption, occupancy/pattern/events, arbitrary currency subdivisions, automatic source-day decoding, source timestamps absent from these models, or production cutover. Preserve the original restricted source export separately; the sanitized report is not a backup.

The root legacy service stores BusinessBrands days as comma-joined labels (src/services/user.service.ts, setBrands). That storage observation does not establish business semantics for every export, so decisions remain explicit.

## Atomic apply and retry

After reviewing a ready report, a trusted operator can run from apps/web:

```sh
npm run migration:apply:tariffs -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <reviewed-report.json>
```

The command checks the report organisation, adapter and sanitized input hash against a fresh source plan. It locks the organisation, rechecks verified Owner/Admin membership, active sites and destination conflicts, then inserts catalogs, site uses, tariffs, audits and one immutable LegacyTariffBatch receipt in a single transaction. A failed insert rolls back all of them. The report is a review artifact, not a cryptographically signed approval; possession never grants permissions. Apply is an operator CLI, not an HTTP endpoint.

The receipt preserves allowlisted original rows, explicit decisions, per-table counts and resolved destination UUIDs, including each band's parent tariff. Identical retries (including concurrent calls) return the original batch ID without creating records or audit events, after checking current permissions. That historical receipt remains valid even if later corrections or site archival occur; retry does not restore historical values. A changed source or decision needs a fresh report and cannot overwrite existing identities. Independently created identical entries are not automatically adopted.

The durable receipt lives in the database; the CLI prints its batch ID. If a connection or terminal fails around commit, repeat the exact command to recover the outcome safely. No report file is overwritten. Apply exits 0 on success/reuse and 1 on failure. Both JSON files are bounded to 2 MB. This path does not change readings, quantities or costs. Real source review and production reconciliation remain open.
