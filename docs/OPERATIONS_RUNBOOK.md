# Operations runbook

Scope: operator-run diagnostics for the Lightsail deployment. Billing, live AI and automatic report delivery remain deferred. These commands do not authorize a deployment, database restore, data deletion or automatic restart.

## Read-only deployment check

From a checked-out release on the deployment host, with authorized Docker access:

```sh
sudo python3 -B deploy/lightsail/diagnose.py
```

The command queries containers labelled for Compose project `energiepad`, excluding one-off migration containers. It inspects only service/state/health, paused/OOM state and restart counts, never environment values or health-log contents. It neither loads runtime environment files nor connects to PostgreSQL/providers. Each Docker call has a 15-second timeout; no logs, container names or IDs are printed. All replicas of `db`, `web` and `worker` must be running, unpaused, not OOM-killed and healthy. Missing health checks fail the check, including older worker images with no progress probe.

| Exit | Status    | Operator action                                                                                                           |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0    | HEALTHY   | Current container probes pass; this is not business or data-correctness acceptance.                                       |
| 1    | ATTENTION | Inspect the service's issue codes using the table below. Startup can legitimately report attention until all probes pass. |
| 2    | UNKNOWN   | Docker is unavailable, access is denied, collection timed out or output was invalid. Do not treat this as healthy.        |

`restartCount` is cumulative container evidence, not a restart rate. Compare successive observations to detect increasing counts. A healthy current probe does not erase earlier failures. The check does not assess backup freshness, disk capacity, pending migrations, external HTTPS, mail, queues or provider accuracy.

## Triage

| Issue                         | Check next                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MISSING_CONTAINER             | Verify the intended host/project and whether deployment completed. Do not create an empty replacement database.                                            |
| NOT_RUNNING                   | Inspect local Compose state and recent deployment failures. Check host resources before a deliberate restart.                                              |
| OOM_OR_UNKNOWN                | Inspect host memory and container limits. Preserve evidence; do not prune database volumes.                                                                |
| HEALTH_STARTING               | Compare elapsed startup with configured grace periods. Persistent startup needs investigation.                                                             |
| HEALTH_NOT_CONFIGURED         | Confirm the deployed image and Compose file both contain the new health-check tooling.                                                                     |
| UNHEALTHY_OR_UNKNOWN (db)     | Check PostgreSQL availability, disk capacity and connection exhaustion.                                                                                    |
| UNHEALTHY_OR_UNKNOWN (web)    | Inspect sanitized `database_health_changed` events and database state. A stalled query can require process recovery after diagnosis.                       |
| UNHEALTHY_OR_UNKNOWN (worker) | Inspect `weather_worker_state`, database connectivity and tenant-authorized job status. A progress timeout is 120 seconds; job lease recovery is separate. |
| INVALID_RESTART_COUNT         | Treat collection as unreliable and investigate Docker metadata/version.                                                                                    |

Use the existing root-only operator path to inspect logs:

```sh
sudo docker compose --env-file /opt/energiepad/release.env -f /opt/energiepad/compose.yml ps
sudo docker compose --env-file /opt/energiepad/release.env -f /opt/energiepad/compose.yml logs --since 15m --timestamps web worker
```

Review logs privately; do not attach raw environment files, auth URLs or database dumps to an incident. New health events contain only allowlisted statuses, but that does not certify every historical log line as safe. The restricted CI SSH key remains deployment-only and is not an interactive diagnostics credential.

For a workspace-specific incident, an authorized Owner/Admin can open Activity log
and filter by the exact Action code or Request ID shown in an event's details.
Both filters apply together. Older/Latest navigation preserves the search;
Clear filters returns to the full workspace history. A request ID is a correlation
value, not an access token, and cannot expose records in another workspace.

Use **Export this page (CSV/JSON)** to retain up to 100 matching events for an
incident. The export carries filters and page cursors; download subsequent pages
separately when needed. It is generated at download time and can include newer
activity than the page last rendered. Each prepared export creates an audit
receipt. CSV protects formula-like text; JSON preserves exact stored values.
Keep exported files in approved private incident storage because authorized
event metadata can contain workspace information. These exports are not backups.

Docker marks unhealthy services but does not restart a running container merely because its health check failed. No automatic remediation or external notification is configured by this increment. A future alert integration should treat ATTENTION and UNKNOWN as actionable, suppress unchanged repeats, report recovery once, and keep payloads limited to this diagnostic schema. Destination, routing, cadence and escalation ownership still need an operator decision.

## Recovery evidence

Record UTC detection/recovery times, issue codes, release identity, sanitized health transitions and any operator action. Verify health again after recovery and review relevant tenant job/report behavior. Image rollback does not reverse schema migrations. Follow the separate restore rehearsal in SPRINT_8_ACCEPTANCE.md before planning database recovery; never restore over the running application merely to clear an alert.

Use completed `*.backup/database.dump` files with their adjacent SHA-256 sidecars.
Ignore `.pending-*` directories left by interrupted backup processes. Published
manifests distinguish archive listing from actual restore verification; a fresh
backup is not automatically a tested recovery point. Legacy standalone dumps
require explicit provenance review and the rehearsal's `--legacy-unverified`
flag when no checksum exists. Never bypass an existing checksum mismatch.

## Planned maintenance freeze

Follow [WRITE_FREEZE.md](WRITE_FREEZE.md) for activation and release. A fresh worker `paused` snapshot is deliberately healthy when `APP_WRITE_FREEZE` is active; stale progress still fails. `X-Write-Freeze: enabled` reports runtime configuration, not a verified drain of every application, legacy or external writer. Existing-session reads remain available, while authentication and audited downloads pause. Frozen deployment failures skip automatic image rollback; select a reviewed freeze-compatible recovery release.
