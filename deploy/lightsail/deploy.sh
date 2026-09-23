#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected commit SHA' >&2; exit 2; }
exec 9>/var/lock/energiepad-deploy.lock
flock -w 900 9
cd /opt/energiepad
for file in runtime.env database.env migration.env; do
  [[ -s /etc/energiepad/$file ]] || { echo "Missing /etc/energiepad/$file" >&2; exit 1; }
done
# Reject incomplete production setup before accepting a large image stream.
if ! grep -Eq '^AUTH_URL=https://[^[:space:]]+' /etc/energiepad/runtime.env; then
  echo 'Configure an HTTPS AUTH_URL in /etc/energiepad/runtime.env before deployment.' >&2
  exit 1
fi
for variable in DATABASE_URL AUTH_SECRET RESEND_API_KEY EMAIL_FROM OPEN_METEO_API_KEY; do
  if ! grep -Eq "^${variable}=.+$" /etc/energiepad/runtime.env; then
    echo "Missing production setting: $variable" >&2
    exit 1
  fi
done
previous=''
[[ ! -f release.env ]] || previous=$(cat release.env)
export APP_IMAGE="energiepad-v2:$1"
gzip -dc | docker image load
docker image inspect "$APP_IMAGE" >/dev/null
compose=(docker compose -f /opt/energiepad/compose.yml)
"${compose[@]}" up -d --wait db
mkdir -p /var/backups/energiepad
# A database backup precedes every migration. Do not auto-reverse schema changes.
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "/var/backups/energiepad/$(date -u +%Y%m%dT%H%M%SZ)-$1.dump"
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
GRANT USAGE ON SCHEMA public TO energiepad_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO energiepad_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO energiepad_app;
REVOKE ALL ON TABLE "_prisma_migrations" FROM energiepad_app;
SQL
if "${compose[@]}" up -d --wait --wait-timeout 180 web worker; then
  printf 'APP_IMAGE=%s\n' "$APP_IMAGE" > release.env
  echo "Deployed $1"
else
  if [[ $previous =~ ^APP_IMAGE=energiepad-v2:[0-9a-f]{40}$ ]]; then
    export APP_IMAGE=${previous#APP_IMAGE=}
    "${compose[@]}" up -d --wait --wait-timeout 180 web worker
    echo 'Restored previous application image; database migrations remain applied.' >&2
  fi
  exit 1
fi
