# Sprint 8 — operational readiness

Started 26 September 2026 after the user deferred billing. Billing, OpenAI execution and automatic report delivery remain deferred; previous scientific and real-source reconciliation gates remain open. Starting independent operational work does not accept those gates or authorize production cutover.

## First increment: isolated backup restore rehearsal

Deployment already creates PostgreSQL custom-format dumps before migrations. `deploy/lightsail/restore-rehearsal.sh` adds an operator-run restore exercise using a fresh PostgreSQL 18 container. It accepts only a local dump path, has no database URL option, publishes no ports, uses no network or production configuration, and removes its container and anonymous volume on success or failure. It restores atomically with errors fatal, checks migration history and reports public-table counts without printing application rows.

Run on a host with authorized Docker access and the `postgres:18-bookworm` image already installed:

```sh
sudo bash deploy/lightsail/restore-rehearsal.sh /private/path/release.backup/database.dump > /private/path/restore-counts.csv
```

Create the output directory privately first (mode 0700) and use `umask 077` for redirection. Allow disk capacity for the restored database in addition to the dump. Use a trusted deployment-generated archive: restoring a database archive executes its SQL. Retain the dump unchanged; the rehearsal never overwrites it. No application or worker starts against the restored database.

Compare the result with counts captured at the matching backup snapshot, record backup hash/time, PostgreSQL image digest, elapsed restore time, database size, migration history and reconciliation verdict. Counts alone do not establish analytics parity. Verify retained report fingerprints, representative energy/carbon totals and tenant access in a separately isolated application exercise before accepting disaster recovery. Production role ownership/grants are intentionally not restored here and require a separate verification. Off-instance backup retention, encryption, RPO/RTO and production rollback approval remain open.

Validation: four Python unittest cases with fake Docker cover isolation flags, paths containing spaces, atomic restore options, cleanup after restore/verification failures, missing-image preflight and missing arguments. Shell syntax also passes. These are script-control tests, not an actual database restore.

Actual restore remains pending: the current host denies Docker socket access and passwordless sudo is unavailable. No production connection, backup extraction, image download or deployment was performed. Run this rehearsal with an existing trusted dump on an authorized Docker host to produce restore evidence.

## Database health observability

`GET /api/health` now bounds its database wait at two seconds, within the deployment probe's four-second HTTP timeout. Its public contract remains `{ status: "ok" }` with HTTP 200 or `{ status: "unavailable" }` with HTTP 503 and `Cache-Control: no-store`. Concurrent requests share one query per loaded monitor. If a query times out, subsequent checks reuse the unavailable result until the underlying query settles, preventing accumulation of abandoned health queries. This deadline does not cancel the database query; a permanently stuck query may require process recovery.

Structured stdout events report only `event: "database_health_changed"` and the status, on the first observation and subsequent transitions. Repeated identical observations are suppressed. Driver errors, connection strings, tenant data and request URLs are never passed to the event sink. Logging failure does not change the health response. Container log timestamps supply event time; transitions are local to each web process and reset on restart.

Six focused tests passed: HTTP success/failure and no-store response shape, timeout and concurrent-probe sharing, outage/recovery transitions, synchronous failures, timer cleanup, late rejection handling and logging failure. TypeScript and focused lint/format checks also passed. No new database migration or deployment is included.

This endpoint tests database connectivity only. It does not certify migration currency, provider health, weather-worker progress, backup freshness or application correctness. Docker marks unhealthy containers but its restart policy alone does not restart a running unhealthy process. An operator must investigate or deliberately restart after reviewing logs; automated alert routing/recovery and worker monitoring remain future increments.

## Weather-worker progress monitoring

The worker now atomically writes a private, mode-0600 snapshot at `/tmp/energiepad-weather-worker-health.json` (override with `WEATHER_WORKER_HEALTH_FILE` for isolated tests). It records only version, process ID, state and timestamp. Successful loop completion records `idle` or `working`; an unexpected loop error records `error`. Startup resets old state to `starting`, and graceful shutdown records `stopped`. Structured `weather_worker_state` logs contain only state transitions, without provider errors, URLs, keys or tenant/job identifiers.

The health CLI rejects absent/malformed snapshots, non-progress states, dead processes, future timestamps and progress older than 120 seconds. No independent heartbeat timer conceals blocked work. The threshold exceeds the existing 90-second job lease. `working` means a processing pass returned, not that enrichment succeeded: individual provider failures and retries remain in tenant-authorized job records. Snapshot write failure stops the worker rather than leaving misleading fresh health.

Compose now checks the worker every 15 seconds with a five-second timeout, three failures and a 30-second startup grace period. This adds worker readiness to deployment's existing `compose up --wait` behavior. It creates no new daemon, network port or database migration. A persistently unhealthy running container still needs operator diagnosis; Docker restart policy does not restart it solely for health-check failure.

Validation includes six unit/CLI tests and an isolated integration smoke test for the actual worker's idle timestamp advancement and SIGTERM shutdown, plus TypeScript, focused lint and formatting. The CLI subprocess test required execution outside the sandbox; the sandbox returned empty captured output. No weather provider call, application database change or deployment is part of this increment. Container-level rollout remains unverified while local Docker access is unavailable.

## Read-only deployment diagnostics and operator triage

Added `deploy/lightsail/diagnose.py` with bounded, project-scoped Docker inspection and sanitized JSON outcomes. It checks every database/web/worker replica, detects missing containers, absent probes, startup/unhealthy states, paused/stopped/OOM states and malformed restart counts. Exit statuses distinguish healthy (0), attention (1) and unavailable diagnostics (2). No container mutation, environment collection, log collection, provider call or database connection occurs.

Seven fixture-based tests passed, covering healthy/partial deployments, unhealthy replicas, unknown states, projection/privacy, bounded read-only commands and collection failure. The real local invocation returned UNKNOWN with exit 2 because Docker access is unavailable; this is not deployed-stack acceptance. The four restore-control tests also passed. Both Python suites now run in CI alongside shell syntax checks. YAML/format/diff validation passed; no production deployment was performed.

OPERATIONS_RUNBOOK.md documents issue-specific triage, safe evidence handling, recovery limits and future alert behavior. Notification routing, automated monitoring and automatic remediation remain unconfigured. This increment is an operator tool and runbook, not an active alerting service.

## Atomic backup publication and restore checksum checks

Fixed deployment's direct-to-final-name dump handling: a failed `pg_dump` could previously leave a partial `.dump` that appeared to be a restore point. A new root-installed Python helper writes into a private temporary directory, requires successful dump and archive listing, writes SHA-256/size/time/target-release evidence, flushes files/directories and renames the complete bundle atomically. Dump or validation failure blocks migration. Existing backups remain untouched. Abrupt termination may leave hidden `.pending-*` directories, which are not completed backup bundles.

Restore rehearsals verify the adjacent checksum before any Docker operation. Missing checksums are rejected unless a reviewed legacy archive is explicitly selected with `--legacy-unverified`; a mismatched checksum always fails. Archive listing/checksum acceptance is not full restore acceptance, and manifests explicitly retain `restoreVerified: false`.

Five backup tests cover successful publication and restrictive permissions, partial/empty/timed-out dumps, archive-list failures, metadata write failure, preservation of earlier backups, unique repeated-release bundles, input validation and sanitized CLI errors. Six restore-control tests include missing/mismatched checksums and legacy opt-in. All seven diagnostics tests continue to pass. The new backup suite is included in CI. Shell syntax, workflow YAML, formatting and diff checks pass.

Real Docker dump/restore and host installation remain pending; no production deployment, backup creation or application data access occurred. The host helper must be installed before the updated deploy script is activated, as documented in the deployment README. No backup schedule, off-instance storage or retention policy is inferred.

## Administrative activity history

Removed the Activity log's newest-100-only navigation limit. Owners/Admins can now follow Older activity and return to Latest activity; each page contains at most 100 events. `GET /api/v1/organisations/:org/audit/history?cursor=:event` returns `{ items, nextCursor }`. The existing `/audit` API retains its array response.

History reads bind cursors to the workspace, use timestamp/UUID ordering and recheck current membership in a repeatable-read transaction on each request. New activity does not shift older-page boundaries. Revoked/unauthorized members and unrelated platform administrators cannot use the history endpoint. Existing event metadata and immutable retention remain unchanged. No schema migration, support impersonation or production deployment is included.

Validation passed: isolated PostgreSQL integration with more than 200 tied-timestamp events, a newer insertion between pages, missing/foreign/invalid cursors, Owner/Admin access, denied other roles, revocation and legacy latest-100 behavior. The browser/HTTP test passed older/latest navigation, page size, disjoint pages, anonymous denial, invalid cursor response, no-store headers, legacy API shape and mobile overflow (38.6 seconds including startup). The database scenario is included in the integration command. TypeScript, focused lint, formatting and diff checks passed. Automatic permission review initially timed out; the permitted retry ran successfully against disposable databases.

## Activity lookup for incident investigation

Activity history now accepts exact `action` and `requestId` filters in its GET API and page. Blank fields are omitted; both supplied filters must match. Action input is bounded to 100 lowercase code characters, and request IDs must be UUIDs. Repeated filter parameters are rejected. Event details expose the existing action code so operators can copy a precise value rather than infer it from display labels.

Older/Latest links retain active filters. Submitting new filters resets the cursor, Clear filters resets the form, and an empty match set has an explicit message. Cursor lookup applies the same workspace and filters as the page query, so a cursor outside the selected result set is rejected. Searches never scan metadata or widen Owner/Admin permissions. The original latest-100 API remains unchanged.

Validation: nine filter/query-link unit cases, isolated database checks and the extended browser workflow passed. Database coverage includes 205 filtered events without duplication, request correlation lookup, intersection of filters, nonmatching cursor rejection and foreign-workspace request IDs. The initial fixture reused one actor correlation ID for two distinct simulated requests; it was corrected to issue separate IDs before the successful run. Browser coverage includes retained filters across pages, request lookup, cursor reset, empty results, Clear filters, duplicate/invalid API filters and mobile overflow (49.1 seconds including startup). No deployment or new database migration occurred.

TypeScript, focused ESLint, formatting and diff checks also passed.

## Audited activity-page exports

Owners/Admins can explicitly download the currently selected history page as CSV or JSON. The endpoint `/api/v1/organisations/:org/audit/export` accepts the same action/request-ID filters and cursor, plus `format=csv|json`. It reads at most 100 matching events at download time; this is not a frozen copy of the previously rendered page or an export of the entire workspace. Both formats include export version/time, workspace, active filters, source/next cursor, page size and event evidence. CSV includes a PAGE record even for empty results and neutralizes spreadsheet formula prefixes; JSON preserves original values.

The service acquires the workspace lock, checks current Owner/Admin access and the filtered cursor, and records `audit.page_exported` with the page boundaries/count/filter values in the same transaction. Audit failure prevents returning the export. The receipt means an export was prepared, not that a browser completed delivery. Plain download links have no prefetch; reloading an export URL creates another receipt. Responses use no-store, attachment filenames and nosniff. No public bearer link, bulk export, retention/deletion change or provider delivery is introduced.

Validation passed: 11 export/filter unit checks; isolated database tests for exact filtered-page contents, pagination metadata, export receipts, revoked access and injected audit failure; and the extended browser test for JSON downloads, older-page scope, CSV/content headers, anonymous/format rejection and recorded exports (50.3 seconds including startup). No production deployment or schema migration is included.

## Cutover and rollback procedure

Added CUTOVER_RUNBOOK.md with a release evidence record, explicit gates, isolated rehearsal, writer freeze/final extraction, backup/schema/data sequencing, reconciliation, traffic decisions and failure-specific recovery. It distinguishes image rollback from database rollback and accounts for new writes accepted after switching traffic.

Review of the deployment script identified a key operational gap: it restarts web/worker after migrations, while the app has no general maintenance/read-only switch. The runbook therefore requires a freeze mechanism that survives restart, or a separately rehearsed maintenance deployment procedure, before a cutover depending on a freeze. No maintenance mode or production command execution is claimed by this document.

Documentation was checked against the migration command contracts, deployment/backup scripts and existing acceptance gates. Links/command names and Markdown formatting were validated. This increment changes documentation only; no application tests, migration, deployment, data extraction or traffic change was required or performed. Real-source reconciliation, actual restoration, recovery objectives, host rollout and cutover ownership remain outstanding.

## Restart-safe application write freeze

Implemented the maintenance control identified by the preceding cutover review. `APP_WRITE_FREEZE` applies read-only PostgreSQL connection defaults, mutation/action/authentication guards, existing-session reads without renewal, workspace notices, paused audited report/download access, a health header and a deliberately paused weather worker. Unexpected nonempty values fail closed. Frozen deployment startup failures skip automatic rollback to potentially incompatible old images. No schema change or runtime activation is included.

Validation passed: 420 unit tests across 54 files; lint and app formatting; disposable PostgreSQL tests rejecting ORM, transactional and raw SQL writes while permitting reads and preserving session expiry; an actual paused-worker lifecycle check against an unreachable database; frozen browser checks for authorized reads, rejected mutations/authentication/webhooks/exports and signup feedback; and the normal login/activity/export browser regression. The first frozen browser run encountered an ambiguous alert selector, corrected to target the maintenance message before the passing rerun. Deployment shell tests cover frozen, invalid and disabled flag recovery paths. The production build, including TypeScript and page generation, passed; documentation formatting, shell syntax and diff checks also passed.

[WRITE_FREEZE.md](WRITE_FREEZE.md) defines installation prerequisites, draining, recreation, verification and release. The setting does not freeze old processes, legacy/external writers or migration-owner operations, and does not cancel in-flight provider calls. Host rollout, actual Docker backup/restoration and cutover reconciliation remain unverified. Billing, live AI and automatic report delivery remain deferred.

## Backup freshness and disk-capacity evidence

Added an operator-run, read-only backup status check with mandatory maximum-age and minimum-free-space thresholds. It reports sanitized aggregate evidence and HEALTHY/ATTENTION/UNKNOWN exit statuses. It rejects inconsistent or oversized metadata, missing/symlink files, future/naive timestamps and archive-size/checksum-declaration mismatches; unfinished attempts and legacy standalone dumps cannot masquerade as completed bundles. Fresh bundles do not conceal invalid siblings. No archive data is hashed or restored, and output explicitly keeps integrity/restore verification false.

Six tests passed covering fresh evidence and file preservation, latest completion and exact threshold boundaries, stale/missing/pending backups, low capacity, malformed bundle cases, sanitized collection failures and CLI validation. The suite is included in CI. All 25 operational safeguard tests (backup status, publication, diagnostics, restore controls and freeze recovery) passed, along with Markdown/workflow formatting and diff checks. The operator runbook distinguishes completion age from RPO and backup-filesystem capacity from Docker-volume capacity. No production backup access, schedule, notification, deletion policy or host rollout is included. Actual restoration and real-source reconciliation remain open acceptance gates.

## Actual restore smoke test in CI

Added an independent `restore-smoke` CI job and `test-restore-docker.sh`. The job installs PostgreSQL 18 Bookworm, builds a custom-format archive from a disposable synthetic database, computes its checksum and invokes the existing isolated restore rehearsal. It compares all restored table counts, including an empty table, then creates a second valid archive containing an unresolved migration and requires the rehearsal to reject it at the migration-history gate. Deployment now depends on this job as well as application checks.

Source and restored databases have no network, published ports, host mounts or production configuration; generated archives live only in a private temporary directory. Cleanup removes each container with its anonymous volume and removes the temporary archives. Three local control-flow tests cover both expected outcomes, dump failure, count mismatch and cleanup/isolation. These are mocked Docker tests and do not establish real restore acceptance. Shell syntax and formatting/diff checks also passed.

The actual container smoke test could not run locally: Docker access remains permission-denied outside the sandbox. Its CI execution is pending; no workflow was pushed or remotely triggered. Even a passing CI run will validate only synthetic archive/script compatibility, not the current application schema, production data, role grants, analytics parity, RPO/RTO or production rollback. The trusted production-backup rehearsal remains a separate open gate.

## Workspace import-retention inventory

Added a read-only Owner/Admin API for seven workbook-import batch categories, with an explicit exclusive creation-time cutoff. Counts distinguish staged, committed and inconsistent status/timestamp combinations, include oldest/newest dates and return zero/null summaries for empty categories. Aggregate counts are decimal strings; no imported content, batch identifiers or authors are selected. Current membership and all aggregates share a repeatable-read transaction; platform admin status does not bypass tenant access. The endpoint remains usable under the write freeze and makes no audit or data changes.

Eight cutoff/query tests and isolated PostgreSQL acceptance passed, covering every category, exact cutoff boundaries, foreign-workspace exclusion, empty categories, roles, revoked membership, platform-admin denial, payload omission, future-date rejection and frozen read-only execution. The initial carbon fixture used an invalid kind; it was corrected to comply with the existing constraint before the passing run. The browser/HTTP regression passed anonymous denial, authorized response shape, no-store headers, missing/duplicate/invalid/future cutoffs and the existing audit workflow (1.2 minutes including startup). TypeScript and focused lint checks pass. See IMPORT_RETENTION.md for the endpoint and scope. Retention periods, legal holds, deletion, bulk workspace export and scheduled cleanup remain unimplemented; age is not deletion eligibility.

## Import-retention workspace page

Added the Owner/Admin interface at `/org/:org/import-retention`, discoverable from Workspace settings and Data. A required date selects an exclusive midnight-UTC cutoff; no default retention age is inferred. The page displays seven responsive cards with exact batch counts, highlighted older staged counts, oldest/newest UTC timestamps and inconsistent-record notices. It explains category coverage and that counts are neither storage sizes nor deletion eligibility. Invalid/repeated/future cutoffs show a message without stale results; Clear and reload preserve the expected form/URL behavior.

The page checks current workspace permission before rendering and calls the existing scoped read-only service. Viewer navigation omits the link and direct access is denied. No cleanup, retention period, automatic report delivery, billing activation or production deployment is included.

Normal browser acceptance passed: Settings discovery, initial state, exclusive date boundary, empty categories, inconsistent-record notice, refresh, Clear, malformed/duplicate/future dates, viewer link omission/direct denial and 390px overflow checks. Desktop/mobile screenshots were inspected. The first viewer assertion expected the default Next.js not-found text instead of this app's custom message; correcting that assertion produced the passing run. Focused lint, app formatting and diff checks passed.

The frozen-runtime browser regression also passed (52.2 seconds including startup), confirming that the page renders its inventory during maintenance while existing mutation/authentication restrictions remain enforced.

## Audited retention inventory evidence

Added explicit JSON downloads from the retention page. The export is bound to the displayed workspace/cutoff/aggregate fingerprint, rechecks Owner/Admin access and rejects changed evidence with HTTP 409. It records `retention.inventory_exported` atomically; audit failure prevents output. Repeated unchanged downloads remain possible and each records a receipt. No uploaded content or individual batch identity is exposed. Export is unavailable during write freeze while aggregate reads remain available.

Fifteen query tests and isolated PostgreSQL checks passed, including stable fingerprints, changed aggregates, cross-workspace fingerprint mismatch, denied/revoked roles, repeated export receipts, injected audit failure with rollback and frozen database rejection. This is aggregate review evidence, not a workspace data export, backup, retention approval or deletion action.

Normal browser acceptance passed JSON download contents, attachment/no-store/nosniff headers, stale-fingerprint HTTP 409, repeated audit receipts and existing retention page/role behavior (two tests, 1.2 minutes including startup). TypeScript, focused lint, formatting and diff checks passed.

The frozen-runtime browser regression passed: inventory reads/page rendering remain available, the download link is hidden and a direct export request returns HTTP 503. No deployment or maintenance activation was performed.

## Inconsistent import record investigation

Added the missing drill-down from retention inventory inconsistency notices. Owners/Admins can inspect batch ID, status, creation and commit timestamps in pages of at most 50. All dates are included, independently of the staged-age cutoff. Older/Latest links retain the selected category and inventory cutoff. Empty categories explain that no inconsistent records remain. No imported payload, mapping, result, author or source fingerprint is selected.

The API and service validate category/cursor inputs, enforce current membership in each repeatable-read page transaction and bind cursors to the same workspace/category/inconsistent subset. UUID tie-breaking preserves boundaries for equal creation timestamps; newer arrivals do not shift older pages. Foreign/missing/other-category or now-consistent cursors fail. Metadata review is allowed during write freeze, with no data or audit writes. No repair, retention approval, deletion or production deployment is included.

Validation passed: 21 input/query unit cases and isolated database checks for all seven categories, metadata-only projection, Owner/Admin and denied/revoked roles, platform-admin denial, scoped cursors, a 110-record tied-timestamp pagination sequence with intervening insertion, and read-only frozen execution. The first added fixture used a status prohibited by the existing check constraint; it was replaced with a permitted status/missing-timestamp inconsistency before the passing run. TypeScript, focused lint, formatting and diff checks passed.

Two browser tests passed (1.7 minutes including startup), covering Inspect records, metadata and no-store responses, 50/1 record pagination, retained category/cutoff, Latest/Close navigation, mobile overflow, existing downloads and viewer denial. No production action was performed.

## Original migration source intake evidence

Added a read-only Python intake command and request template for recording original export/schema identity before adapter transformation. It requires explicit source, extraction time, scope, target UUID and file roles; streams complete files into SHA-256/byte evidence; rejects empty/nonregular/symlink-final-component and duplicate source files; and detects changes across hashing. A private completed manifest is published without overwriting prior evidence. It contains no source row contents, makes no database/network calls, and cannot approve source identity or reconciliation.

Six local test cases passed for exact evidence and source preservation, output permissions/collisions/symlinks, invalid metadata and timestamps, duplicate/nonregular/empty inputs, mid-hash mutation and CLI bounds/sanitized failures. Tests are included in the operational CI checks, and workflow path triggers include this tool directory. Documentation and template describe private evidence handling and limits. Real-source intake and reconciliation remain pending; only synthetic temporary fixtures were read by validation. No production data, imports, deployment, retention or deletion actions occurred.

## Preserved-source manifest verification

Added `source-manifest.py --verify` to recheck original exports/schema against an existing intake record without modifying either. It validates the complete bounded manifest contract before reading referenced files, compares streamed size/SHA-256 evidence, detects reused file identities and reports per-index results without private labels, paths or contents. Overall MATCHED/ATTENTION/INVALID_OR_UNAVAILABLE_MANIFEST outcomes use exits 0/1/2. The result binds to the exact manifest bytes with its own digest; it does not authenticate a manifest or approve source identity/reconciliation.

All 11 intake/verification test cases passed. New coverage includes unchanged evidence, same-size mutation, missing/symlink/nonregular files, malformed contracts and evidence types, duplicate identities, unstable reads, private output, CLI exits/digest and preservation of manifest bytes. The existing creation tests remain green after bounded regular-file metadata loading was shared. Both suites run in CI. Documentation explains mismatch handling and trust limitations. Validation used synthetic temporary files only; no real source, database, provider, migration or deployment was accessed.
