# Reviewed consumption and meter migration

Sprint 3 provides a bounded, operator-only JSON preview/apply adapter for BusinessFuelsSize and UtilityConsumptions. It reuses the normal reading validation/calculation pipeline. It does not connect to the legacy database, automatically split totals between meters, or infer ambiguous dates, tax rules or driver units.

## Commands

Run from apps/web:

```sh
npm run migration:preview:energy -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <new-report.json>
npm run migration:apply:energy -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <reviewed-report.json>
```

Source files are bounded to 2 MB and 500 rows per table. Reviewed reports may be up to 16 MB. Preview is a repeatable-read, read-only transaction; it writes a new private mode-0600 file without overwriting. Exit codes: 0 ready, 2 report with blockers, 1 invalid input/access/file error. Apply exits 0 for a new or previously completed batch and 1 for failure. If interrupted around commit, retry the identical source/report to recover the batch ID safely.

Example format: apps/web/tests/fixtures/legacy-energy.json. Its IDs are placeholders, not a seed request. Use decimal strings for exact source values. IDs are strings; timestamps are explicit ISO timestamps with an offset or null when absent. Dates with unresolved month meaning remain original text, and require an explicit reviewed destination month. Unknown source columns are stripped before hashing/storing; source schema errors block the input. Keep the restricted original export separately as the sanitized ledger is not a backup.

## Meter identity and allocation

Register the destination sites, fuel/end-use identities, meters and sourced conversion versions first using the existing scoped workflows. The adapter maps to these registered destinations; it does not create meters with guessed names, fuels or units.

Every BusinessFuelsSize row requires a decision with a target site/end-use code, explicit SINGLE/COMMA/SEMICOLON/NEWLINE split format, and a one-to-one token-to-meter-ID mapping. Every token must be retained exactly once after whitespace trimming. Empty/duplicate tokens, extra/missing decisions, unavailable sites/meters, wrong fuel and inconsistent registered source identities block migration. A source site maps to one destination site and different source sites cannot collapse silently. The immutable source ledger retains the original meter-list string, all tokens, reviewed reason and target meter snapshots.

Every consumption row references one mapped meter-list row and one of its meters, with the same source site/fuel/use IDs. A reading maps to exactly one meter/month. Several rows targeting one meter/month are blocked; there is no implicit aggregation or allocation. An identical previously committed meter mapping can be reused in later batches; changed mapping/source evidence is a conflict. Meter mappings are distinct from consumption amounts and do not duplicate totals.

## Required reading decisions

Each source row retains id, siteId, fuelSourceId, usedInId, date, consumption, totalCost, vat, vatCost, conversionFactor, fuelUnit, created_at, updated_at, population and workingHours. A required reason explains the reviewed interpretation.

- Choose the month, source unit spelling/meaning, actual/estimated status, currency, NET/GROSS cost basis and PERCENT/FRACTION VAT basis. No original value is replaced in the evidence ledger.
- Gross cost requires a VAT rate to derive net. Net is rounded to three decimals; normal reading tax rules then calculate VAT/gross. Source VAT and total cost stay independent, with calculated-minus-supplied deltas. Uncomparable or differing values require explicit acceptCostDifference and the review reason; discrepancy flags remain on the reading.
- Pin conversionVersion to energy-si-v1 for kWh/MWh, or to an approved meter-specific conversion UUID covering the complete month. KWH_PER_SOURCE_UNIT requires the supplied factor to agree. PRESERVE_ONLY explicitly retains a factor with unresolved/different semantics while applying the separately reviewed V2 conversion. Factor/unit mismatches are never silently used to alter a quantity. Excess quantity/rate precision is rejected by normal reading validation.
- Population may be PRESERVE_ONLY or MONTHLY_AVERAGE; workingHours may be PRESERVE_ONLY or MONTHLY_TOTAL. Original values remain in either case. When creating drivers, equal site/month values across meter rows produce one observation, not a sum. Conflicting values block the batch. Existing drivers are either rejected or explicitly reused under REUSE_EQUAL only when their current value agrees. Null remains absent; zero is a value. Monthly hours must pass calendar-hour validation. Preserved-only values never become derived observations.

## Reconciliation, writes and corrections

Preview includes every source row and decision, destination snapshots, prepared reading values, per-row cost/VAT comparisons, grouped driver decisions, mapping counts and totals grouped by site/source unit/currency/cost basis. Missing source/calculated costs have separate counters; partial sums must not be mistaken for complete totals. In a blocked report, totals cover only successfully prepared rows. Rates/factors are not summed, and currencies are not mixed.

Apply locks the organisation, rechecks verified Owner/Admin membership, source/decision hash and the entire prepared target signature. Changed meter metadata, conversion, site attributes, occupied periods or driver revisions require fresh review. Reading, driver, source ledger, receipt and audit writes commit together; any failure rolls them all back. A unique source namespace/table/ID prevents importing a source reading again under a different bundle. Identical concurrent/repeated applies return the immutable prior receipt after checking current permission, even when later corrections exist.

LegacyEnergyBatch stores the immutable reviewed plan/counts/totals; LegacyEnergyRow resolves source rows to reading/meter/conversion/driver targets. ConsumptionRecord.sourceProvenance separately preserves original timestamps and supplied values, review decisions, original reconciliation and driver target IDs. Migration creation time is not substituted for source timestamps. Corrections carry this JSON unchanged, enforced by a database trigger, even when current quantities/costs/conversion change. Reading history → Saved provenance → Original migration evidence displays original values and differences, explicitly labelled as the original import.

This closes the missing executable destinations/mapping path in audit point 4. Actual production source review, reconciliation and cutover remain open. Multi-meter allocations and automatic ambiguity resolution are intentionally blocked rather than fabricated.
