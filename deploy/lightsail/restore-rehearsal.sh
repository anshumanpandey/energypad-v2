#!/usr/bin/env bash
# Restore only into a new, isolated container. Never accepts a database URL.
set -Eeuo pipefail
umask 077
legacy=false
if [[ ${1:-} == --legacy-unverified ]]; then
  legacy=true
  shift
fi
if [[ $# != 1 || ! -f $1 || ! -r $1 || ! -s $1 ]]; then
  echo 'Usage: bash restore-rehearsal.sh [--legacy-unverified] /absolute/path/to/backup.dump' >&2
  exit 2
fi
backup=$(realpath -- "$1")
if [[ -f $backup.sha256 ]]; then
  expected=$(cat -- "$backup.sha256")
  actual=$(sha256sum -- "$backup")
  [[ $expected =~ ^[a-f0-9]{64}$ && $expected == "${actual:0:64}" ]] || {
    echo 'Backup checksum invalid or mismatched; restore refused.' >&2
    exit 1
  }
elif [[ $legacy == true ]]; then
  echo 'Legacy archive has no checksum; provenance and integrity remain unverified.' >&2
else
  echo 'Backup checksum missing; use --legacy-unverified only for a reviewed legacy archive.' >&2
  exit 1
fi
image=postgres:18-bookworm
docker image inspect "$image" >/dev/null
name="energiepad-restore-$(cat /proc/sys/kernel/random/uuid)"
created=false
cleanup() {
  if [[ $created == true ]]; then
    docker rm --force --volumes "$name" >/dev/null || {
      echo "Cleanup failed; remove rehearsal container $name and its anonymous volume." >&2
      return 1
    }
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# No published ports, network, host mounts, production environment or named volume.
# Trust applies only to this network-isolated, disposable database.
created=true
docker run --detach --pull never --name "$name" --network none \
  --label energiepad.purpose=restore-rehearsal \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=rehearsal \
  "$image" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$name" pg_isready -U postgres -d rehearsal >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ $ready == true ]] || { echo 'Rehearsal database did not become ready.' >&2; exit 1; }
# Stream the archive; no copy of the dump is written into the container filesystem.
docker exec -i "$name" pg_restore -U postgres -d rehearsal \
  --exit-on-error --single-transaction --no-owner --no-privileges < "$backup"
# Output schema/table counts only, never application row contents or credentials.
docker exec -i "$name" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d rehearsal <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public."_prisma_migrations"
                WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'Missing migration history or unresolved failed migration';
  END IF;
END $$;
CREATE TEMP TABLE restore_counts (table_name text, row_count bigint);
DO $$ DECLARE item record; total bigint; BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', item.tablename) INTO total;
    INSERT INTO restore_counts VALUES (item.tablename, total);
  END LOOP;
END $$;
COPY (SELECT * FROM restore_counts ORDER BY table_name) TO STDOUT WITH CSV HEADER;
SQL
echo 'Restore rehearsal passed; compare these counts with the matching backup-time source counts.' >&2
echo 'This does not verify application roles, analytics totals, production cutover or recovery time objectives.' >&2
