#!/usr/bin/env bash
# Actual synthetic archive/restore smoke test. Requires a preinstalled image.
set -Eeuo pipefail
umask 077
image=postgres:18-bookworm
docker image inspect "$image" >/dev/null
root=$(mktemp -d)
source_name="energiepad-restore-source-$(cat /proc/sys/kernel/random/uuid)"
created=false
cleanup() {
  local result=0
  if [[ $created == true ]]; then
    docker rm --force --volumes "$source_name" >/dev/null || result=1
  fi
  rm -rf -- "$root"
  return "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
created=true
docker run --detach --pull never --name "$source_name" --network none \
  --label energiepad.purpose=restore-ci \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=fixture "$image" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  # The image's temporary initialization server only listens on a Unix socket.
  # Wait for the final TCP listener, after POSTGRES_DB has been created.
  if docker exec "$source_name" pg_isready -h 127.0.0.1 -U postgres -d fixture >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ $ready == true ]] || { echo 'Synthetic source did not become ready.' >&2; exit 1; }
docker exec -i "$source_name" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d fixture <<'SQL'
CREATE TABLE public."_prisma_migrations" (id text PRIMARY KEY, finished_at timestamptz, rolled_back_at timestamptz);
INSERT INTO public."_prisma_migrations" VALUES ('synthetic', now(), NULL);
CREATE TABLE public."RestoreFixture" (id integer PRIMARY KEY, reading numeric(18,6) NOT NULL);
INSERT INTO public."RestoreFixture" VALUES (1, 123.456789), (2, 0), (3, -4.500000);
CREATE TABLE public."EmptyFixture" (id integer PRIMARY KEY);
SQL
rehearsal=$(dirname "$(realpath "$0")")/restore-rehearsal.sh
make_dump() {
  docker exec "$source_name" pg_dump -U postgres -d fixture -Fc > "$root/fixture.dump"
  local digest
  digest=$(sha256sum "$root/fixture.dump")
  printf '%s\n' "${digest:0:64}" > "$root/fixture.dump.sha256"
}
make_dump
bash "$rehearsal" "$root/fixture.dump" > "$root/counts.csv"
python3 - "$root/counts.csv" <<'PY'
import csv
import sys
with open(sys.argv[1], newline='') as source:
    rows = list(csv.DictReader(source))
expected = [
    {'table_name': 'EmptyFixture', 'row_count': '0'},
    {'table_name': 'RestoreFixture', 'row_count': '3'},
    {'table_name': '_prisma_migrations', 'row_count': '1'},
]
if sorted(rows, key=lambda row: row['table_name']) != expected:
    raise SystemExit('Synthetic restore counts did not match.')
PY
# A valid archive with unresolved migration history must fail after restoration.
docker exec -i "$source_name" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d fixture <<'SQL'
INSERT INTO public."_prisma_migrations" VALUES ('unfinished', NULL, NULL);
SQL
make_dump
if bash "$rehearsal" "$root/fixture.dump" > "$root/rejected.csv" 2> "$root/rejected.log"; then
  echo 'Unresolved migration history unexpectedly passed rehearsal.' >&2
  exit 1
fi
# Verify that rejection reached the migration gate rather than an unrelated failure.
grep -q 'Missing migration history or unresolved failed migration' "$root/rejected.log"
echo 'Synthetic PostgreSQL restore and failed-migration rejection passed.'
echo 'This does not accept production backups, application parity, grants or recovery objectives.'
