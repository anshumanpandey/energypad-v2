# Import retention inventory

Sprint 8 provides a read-only inventory to inform retention decisions. It does not set a retention period, declare records safe to delete, or implement deletion.

## Workspace page

Owners and Admins can select **Review import retention** in Workspace settings or Data. The page at `/org/<organisation-id>/import-retention` initially requests a cutoff date and fetches no inventory until one is selected. Dates use midnight UTC with an exclusive boundary, regardless of browser timezone. Review imports loads a fresh snapshot; the URL preserves the date through refresh, and Clear removes it.

Seven responsive cards show the staged-before-cutoff count, total, staged, committed and inconsistent counts, plus oldest/newest timestamps in UTC. Empty categories show zero counts and no batch dates. Inconsistent records have an explicit review notice. Invalid, repeated or future cutoffs show a validation message without results. The page enforces the same Owner/Admin permission before rendering and stays read-only during maintenance freeze.

## Authorized endpoint

An authenticated current workspace Owner or Admin can request:

```text
GET /api/v1/organisations/<organisation-id>/import-inventory?before=2020-02-01T00:00:00Z
```

Exactly one `before` timestamp with an explicit timezone is required. Unknown query keys, repeated cutoffs, invalid dates and future cutoffs fail with HTTP 400. The cutoff is normalized to UTC. It is an exclusive creation-time boundary, not an expiry date. URL-encode offset timestamps (especially the `+`) when building a query.

The `retention:read` permission is limited to Owner/Admin. Every call checks current membership and all seven aggregates in one repeatable-read transaction. Revoked and foreign members cannot retrieve counts; platform-administrator status grants no bypass. Responses retain the shared API's no-store and request-ID headers. No audit write or lock is required for this aggregate read, which remains available during the application write freeze.

## Response and scope

Version 1 includes the workspace ID, observation time, normalized cutoff, aggregate fingerprint, `deletionEnabled: false` and seven summaries: sites, energy, drivers, occupancy, patterns, events and carbon. Carbon covers all workbook kinds stored in `CarbonWorkbookBatch`. Archived sites are included because their import records remain retained.

Each summary contains exact decimal-string counts (avoiding JavaScript integer precision loss):

- `total`: every stored batch in that category and workspace.
- `staged`: UPLOADED, READY or INVALID with no commit timestamp.
- `committed`: COMMITTED with a commit timestamp.
- `inconsistent`: any other status/timestamp combination, for investigation.
- `stagedBeforeCutoff`: staged batches created strictly before the supplied cutoff.
- `oldestCreatedAt` and `newestCreatedAt`: creation dates across all batches, or null when empty.

Imported sheets, previews, results, mappings, receipts, fingerprints, authors and individual batch IDs are not selected or returned. Aggregation returns seven rows regardless of batch volume; the database still scans scoped batch metadata. Counts are not storage-byte estimates, upload-row counts or evidence that data is unused. No unbounded detail listing is exposed.

The inventory excludes legacy migration receipts, application observations and revisions, audit events, retained reports, authentication records, provider jobs and off-instance backups. It is not a complete workspace export or data-retention implementation. Existing provenance references and immutable evidence must remain intact.

## Decisions before cleanup

Define approved retention periods per data class, treatment of active previews and retry identities, legal/customer holds, retained provenance, backup disposition and who may authorize deletion. A staged batch can still be in active use; age alone cannot justify removal. Any future cleanup must recheck current state and references transactionally and preserve required evidence. No scheduler or cleanup action is enabled by this inventory.

## Audited JSON evidence download

After reviewing an inventory, Owner/Admin users can select **Download inventory JSON**. The explicit download link does not prefetch. `GET /api/v1/organisations/:org/import-inventory/export` requires exactly one `before` and one 64-character lowercase SHA-256 `fingerprint`. The page supplies both from its displayed snapshot. Malformed/missing/repeated query values fail with HTTP 400.

The service rechecks current workspace permission, reads a consistent snapshot and compares a versioned fingerprint of workspace, normalized cutoff and all seven aggregate summaries (including dates). Observation time is excluded so an unchanged review can be downloaded later. Different aggregate evidence returns HTTP 409/STALE_INVENTORY with instructions to refresh. The fingerprint is a consistency check, not an access token; changes to underlying payloads that leave these aggregates unchanged are outside its scope.

Successful preparation creates `retention.inventory_exported` with cutoff, fingerprint and category count in the same transaction. Audit failure prevents returning evidence. Each download request records another receipt, which proves preparation rather than completed browser delivery. JSON has export version `import-inventory-v1`, exact string counts, normalized UTC dates and `deletionEnabled: false`; it contains no individual import rows or uploaded contents. Attachment responses use no-store and nosniff headers. This is aggregate review evidence, not a full workspace export or backup.

The audited download pauses during write freeze; the page hides its link and explains why. Ordinary inventory reads remain available. Keep downloaded evidence in approved private storage. No retention or deletion policy is activated by exporting it.

## Investigating inconsistent records

Each nonzero inconsistent count now has **Inspect records**. The read-only view shows at most 50 batch IDs, stored statuses, creation timestamps and commit timestamps, with Older records, Latest records and Close record review navigation. Missing commit timestamps are labelled Not recorded. The view includes all creation dates, matching the inconsistent count rather than the staged-before-cutoff count. The selected inventory cutoff remains in the URL. Counts and detail pages are separate snapshots; refresh if records changed between requests.

The companion endpoint is `GET /api/v1/organisations/:org/import-inventory/inconsistent?category=sites&cursor=<optional-batch-id>`. Category is one of sites, energy, drivers, occupancy, patterns, events or carbon. It rejects unknown/repeated parameters and malformed cursors. Responses contain `{ category, items, nextCursor }` with no-store headers. Every request checks current Owner/Admin membership and uses a repeatable-read transaction. No platform-admin bypass is introduced.

A cursor must belong to the same workspace/category and still identify an inconsistent record. Missing, foreign, other-category or now-consistent cursors return 404; return to Latest records or refresh instead of guessing a replacement. Descending creation-time/UUID ordering preserves older-page boundaries when newer records arrive, including tied timestamps. The view selects only four metadata fields; imported sheets, results, mappings, author identities and fingerprints remain excluded. Batch IDs are investigation identifiers, not access tokens or permission to modify records. Ordinary review remains read-only during a write freeze and creates no audit entry.

This does not repair inconsistent records or identify batches that can safely be deleted. Use reviewed application/data-repair procedures after determining their cause.
