# Restart-safe application write freeze

`APP_WRITE_FREEZE=true` is an operator-controlled runtime setting. It is implemented but **not enabled on the local app or production by this change**. Missing/empty or exact `false` leaves normal behavior; any other nonempty value fails closed as frozen. Use unquoted `true`/`false`. No browser or API can change this setting.

## Scope and behavior

- Shared runtime PostgreSQL connections start with `default_transaction_read_only=on`, including new connections after restart. This rejects ordinary ORM, transactional and raw SQL changes to persistent tables, including writes hidden behind GET operations. It is an application safeguard, not a security boundary against administrators or trusted code deliberately overriding PostgreSQL settings.
- Authenticated API mutations return 503/WRITE_FREEZE before application work. Reads requiring writes, such as audited downloads, also remain unavailable. Authentication and origin checks still apply.
- Password login/signup, email login/callbacks, sign-out, onboarding writes and Stripe receipt intake pause. Webhook 503 responses do not acknowledge receipt. Existing sessions can read ordinary authorized pages without session renewal or expired-session deletion; expiry and current membership still apply. No session lifetime is extended. Establish an operator session before freezing.
- Workspace pages display a maintenance notice. Retained reports show a pause message because viewing requires an audit write. Health emits `X-Write-Freeze: enabled|disabled`; connectivity status remains separate.
- The weather worker checks the flag before processing, records fresh `paused` snapshots and starts no jobs/provider requests. Pause is healthy only in a frozen runtime; stale progress is still unhealthy.

This does not freeze legacy services, external database clients, already-running processes/connections or separately authorized migration-role operations. It does not cancel in-flight provider calls. Drain all relevant writers before final extraction/backup. Do not toggle environment variables inside a running process: its existing database pool retains startup settings.

## Prerequisites

First install and validate a freeze-capable release and matching host deploy/Compose scripts while normal operation is intended. An old image cannot be frozen merely by adding the variable. All replicas must support it. The restricted CI key cannot update root-owned host scripts.

The updated deploy script skips automatic image rollback whenever the runtime file has a nonempty freeze value other than exact `false`: older images may ignore the flag. Frozen deployment failure requires an operator-selected compatible recovery release. The migration service uses its separate owner environment; the runtime flag neither freezes nor authorizes those operations.

## Reviewed activation

Use only within the approved change window in CUTOVER_RUNBOOK.md:

1. Record operator, target identity, release and freeze decision. Prevent concurrent deployments and inventory application, legacy and external writers.
2. Set `APP_WRITE_FREEZE=true` in the existing root-only `/etc/energiepad/runtime.env`. Keep runtime and migration credentials separate.
3. Gracefully stop/drain every old web and worker replica. Verify completion and database connection state; undrained processes may still commit writes. Editing the file is not a verified freeze boundary.
4. Recreate web/worker with the reviewed freeze-capable image and updated environment. Compose `restart` alone does not reload an env file; use the reviewed `up --force-recreate` operation and correct release environment.
5. Verify each web replica's health header, runtime database setting, maintenance notice and an authorized read. Verify fresh worker `paused` state. Confirm legacy/external writers are separately stopped. Healthy container status alone does not establish a freeze.
6. Record the verified boundary before separately approved backup, extraction, migration and reconciliation. Routine deployment preserves the environment setting but is not a cutover orchestrator.

Read-only verification in the reviewed runtime container:

```sh
sudo docker compose --env-file /opt/energiepad/release.env -f /opt/energiepad/compose.yml exec -T web \
  node --import tsx --input-type=module -e 'import { db } from "./src/server/db.ts"; try { console.log(await db.$queryRawUnsafe("SHOW default_transaction_read_only")); } finally { await db.$disconnect(); }'
```

Expect `on`. This opens a fresh runtime connection; it does not prove old writers were drained. Record that separately. Never test the freeze by attempting a sample production mutation.

## Release and failure handling

After the approved decision, set exact `false`, drain frozen processes and recreate all replicas. Check the disabled health header, database setting `off`, normal authentication and worker `idle`/`working` progress. Resume other writers deliberately and record the first accepted new-write boundary. File edits do not update existing pools.

If verification fails, keep writers constrained and investigate the release/environment mismatch. Do not fall back to a pre-freeze image just to clear health alarms. The runtime freeze does not replace restore evidence, reconciliation or controls on direct database writes.
