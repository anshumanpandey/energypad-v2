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
