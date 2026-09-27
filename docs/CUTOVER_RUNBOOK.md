# V2 migration and cutover runbook

Status: **not cleared for production cutover**. Prepared from the existing implementation and acceptance records. Source reconciliation, a demonstrated restore and rollout decisions remain outstanding. This document is a procedure for review, not authorization to execute production changes.

## Release record

Complete a private copy for each planned cutover. Use identifiers and restricted evidence paths; never paste secrets, connection strings, raw exports or authentication tokens.

| Field                                                                     | Required value                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Change owner, operator, independent reviewer                              | Pending                                                               |
| Change window and decision deadline (UTC)                                 | Pending                                                               |
| Intended host, database identity, workspace scope                         | Pending verification; do not infer from a shell's current environment |
| Tested commit/image digest and previous compatible release                | Pending                                                               |
| Installed host scripts and Compose revision                               | Pending verification; CI image deployment does not update these files |
| Legacy source identity, extraction time, schema/export hashes             | Pending; see PRODUCTION_RECONCILIATION.md                             |
| Reviewed mapping bundles and preview evidence                             | Pending                                                               |
| Restore-tested backup bundle/hash and measured restore duration           | Pending                                                               |
| Approved recovery point/time objectives, backup destination and retention | Pending                                                               |
| Write-freeze mechanism, workers/writers covered and validation evidence   | Pending                                                               |
| Traffic-switch operator, route and reversal procedure                     | Pending                                                               |
| Go/no-go decision, reviewer and UTC time                                  | Pending                                                               |

## Gates before scheduling a change

| Gate                          | Evidence needed                                                                                                | Current position                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Source coverage and parity    | Independently measured original counts/totals, reviewed exclusions, mappings and ready dry runs                | Real sources and reviewed mappings not supplied                                                          |
| Recoverability                | Successful isolated restore, content/constraint checks, correct runtime grants and application smoke tests     | Backup/restore tools have control tests; actual restore remains unverified                               |
| Release quality               | CI for the exact commit; critical browser, tenant and numerical compatibility evidence                         | Focused local acceptance exists; no final candidate release identified                                   |
| Host readiness                | Matching backup helper/deploy/Compose installation, actual service health, capacity and private backup storage | Host rollout and Docker validation remain pending                                                        |
| Secure production entry point | Intended HTTPS host, stable routing, authenticated smoke tests, required mail/provider behavior                | Prior IP-preview/domain deferral does not establish production HTTPS acceptance                          |
| Scientific claims             | Preserve existing validation labels; any stronger claim has an approved methodology and tests                  | Positive savings verification remains blocked separately                                                 |
| Scope and data handling       | Explicit release scope, retained-data handling and approved recovery objectives                                | Billing, live AI and automatic report delivery remain deferred; retention/deletion decisions remain open |

No silent waivers: record the accountable decision and release restriction for any intentionally deferred scope. A healthy container, matching checksum or ready preview is not a substitute for these gates. Do not activate deferred features to make a checklist appear complete.

## Rehearsal before the production window

1. Verify the intended source, target and actor independently. Preserve original legacy exports/schema and their hashes. Inventory all relevant tables and relationships; the energy/tariff adapters do not certify occupancy, patterns, event logs or every legacy table.
2. Prepare bounded migration bundles with explicit units, periods, timezone, tax, cost and relationship decisions. Account for every source row across partitions. Use PRODUCTION_RECONCILIATION.md for input bounds and evidence fields; never truncate a source to fit a batch.
3. On an isolated target, register the reviewed prerequisites and run the read-only energy/tariff previews. Review source counts and grouped totals independently, including unmapped/excluded rows, null counters and accepted differences. The workbook tolerance of 0.99 is not a migration reconciliation tolerance.
4. Apply only reviewed bundles on the isolated target. Record immutable receipts, source identities, target IDs and audits. Retry the identical bundle/report after an ambiguous interruption; do not change identities or import the same data under a new source namespace.
5. Restore a trusted backup into an isolated environment and compare it with evidence from the matching backup snapshot. Exercise actual application reads, tenant boundaries, representative energy/carbon totals, retained-report fingerprints, constraints and runtime grants. The current rehearsal tool ignores original owners/ACLs; validate those separately. Keep application/provider workers disabled in the restore environment until their test behavior is explicitly controlled.
6. Demonstrate application rollback against the migrated schema. If the old image cannot operate safely with the new schema, record a database-recovery strategy and measured downtime before proceeding. Keep the legacy database and the previous application image.

Existing commands (run from `apps/web` with reviewed private environment configuration and explicit placeholder substitutions):

```sh
npm run migration:preview:tariffs -- <organisation-id> <owner-or-admin-id> <tariff-bundle.json> <new-tariff-report.json>
npm run migration:preview:energy -- <organisation-id> <owner-or-admin-id> <energy-bundle.json> <new-energy-report.json>
```

Preview exit 0 means no detected blockers, 2 means blockers were recorded, and 1 means input/access/file/connection failure. Preview approval does not authorize production apply. See LEGACY_ENERGY_MIGRATION.md and LEGACY_TARIFF_DRY_RUN.md for reviewed apply contracts. Store reports privately and do not overwrite prior evidence.

## Authorized production window

Execute this sequence only after the release record and gates are accepted.

1. **Reconfirm identity and release.** Verify the host/database/workspaces, candidate image and previous image. Prevent competing deployments for the window; the deployment lock alone does not stop application writes or independently invoked migration tools.
2. **Freeze all relevant writers.** Activate the reviewed mechanism covering legacy writes, V2 APIs/imports, weather workers and any external integration writers. Verify the freeze with concrete checks. Follow WRITE_FREEZE.md for the V2 runtime setting, drain/recreation and per-replica verification. Host rollout remains unverified; legacy/external writers need separate controls. Do not treat stopping the web container as proof that every writer stopped.
3. **Capture the final source and recovery point.** Record the extraction boundary and any delta since rehearsal. Create and verify the pre-change backup and its private off-instance copy using the approved policy. Use completed `*.backup` bundles only; ignore `.pending-*`. A published manifest still has `restoreVerified: false` until separately demonstrated. Stop on any dump, checksum or archive-validation failure.
4. **Apply compatible schema changes.** Use the tested release and established deployment procedure. The deploy script backs up before migration but also starts web/worker afterward; the reviewed freeze must remain effective across these restarts, or a separately rehearsed maintenance deployment procedure is required. Do not assume routine auto-deployment is a complete cutover orchestrator.
5. **Re-preview and apply reviewed data.** Regenerate production previews against the actual frozen target, review all differences from rehearsal, then run only the separately authorized apply operations. Preserve every batch receipt. A stale target signature or changed source requires fresh review, not bypassing the validator.
6. **Reconcile before traffic.** Compare original/mapped/excluded counts, duplicate/dangling identities, totals grouped by site/meter/period/unit/currency and source-to-target receipts. Keep nulls distinct from zero. Investigate discrepancies while writes remain frozen.
7. **Validate the candidate.** Run read-only diagnostics and authenticated smoke tests for sign-in, workspace/site access, representative analytics, retained report downloads and audit history. Test that revoked/foreign memberships remain denied. Validate worker progress separately from individual weather-job outcomes. Recheck deferred-feature flags and scientific labels.
8. **Make the go/no-go decision.** Record reviewer, evidence and time. Switch traffic only through the reviewed route. Release the write freeze deliberately and record the first accepted new writes; this changes which rollback options are safe.
9. **Observe and close.** Verify post-switch health, representative writes, job processing and reconciliation deltas. Keep an accountable operator through the approved observation window. Preserve evidence, backup and legacy source until the approved retention decision allows disposition; cutover success alone does not authorize deletion.

## Failure and rollback decisions

| Failure point                              | Required response                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup failure or mismatched checksum      | Stop before migration; preserve earlier backups and investigate capacity/access/archive errors.                                                                                                                     |
| Migration error                            | Stop and inspect migration state. Do not reset the database, edit applied migration history or retry blindly.                                                                                                       |
| Candidate web/worker startup fails         | Normal deployments attempt the previous image; frozen deployments skip automatic rollback because old images may ignore the flag. Schema changes remain applied. Use a reviewed freeze-compatible recovery release. |
| Apply outcome is ambiguous                 | Keep the target frozen, inspect the immutable receipt, and retry only the exact reviewed bundle/report through its idempotent path.                                                                                 |
| Reconciliation or tenant-isolation failure | Do not switch traffic or release writes. Preserve evidence and decide whether a fix, compatible image rollback or tested database recovery is appropriate.                                                          |
| Failure after new V2 writes were accepted  | Do not overwrite the database with an older backup. Capture the new-write boundary and preserve the current state; select an explicitly reviewed forward fix or recovery with delta replay/reconciliation.          |

Database recovery is a separate destructive change requiring its tested target, preserved current state, recovery point, downtime and delta-handling decision. This runbook intentionally provides no copy-paste command to overwrite a production database. A traffic reversal is unsafe if the legacy system cannot account for new V2 writes.

## Acceptance record after execution

Record actual command/release identities, source/backup hashes, start/end and freeze/unfreeze times, preview/apply receipts, reconciliation totals and verdicts, access/smoke results, incidents and recovery actions, traffic decision, observation result and reviewer sign-off. An unexplained discrepancy leaves cutover unaccepted. Link the completed private evidence record from the sprint acceptance document without committing customer data or secrets.
