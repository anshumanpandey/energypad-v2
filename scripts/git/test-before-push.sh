#!/usr/bin/env bash
# Run from any working directory; never invoke the legacy root npm test.
set -eo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root/apps/web"

# Git GUIs often start without the user's interactive Node PATH.
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' ; then
  nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -f "$nvm_script" ]]; then
    source "$nvm_script" --no-use
    nvm use 22
  fi
fi
set -u
fail() { echo "Pre-push blocked: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail 'Install Node.js 22.12+ and make it available to Git (or install Node 22 with nvm).'
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' || fail 'Node.js 22.12+ is required.'
for tool in npm python3 docker; do
  command -v "$tool" >/dev/null 2>&1 || fail "Required command missing: $tool."
done
[[ -d node_modules ]] || fail 'Run npm ci from apps/web first.'
docker info >/dev/null 2>&1 || fail 'Docker is unavailable. Start Docker and ensure your user can access it; the restore smoke test is required.'
docker image inspect postgres:18-bookworm >/dev/null 2>&1 || fail 'Install the restore test image with: docker pull postgres:18-bookworm'

trap 'echo "Pre-push checks failed; push cancelled." >&2' ERR
step() { echo; echo "==> $*"; "$@"; }
for script in "$root"/deploy/lightsail/*.sh "$root"/scripts/git/*.sh "$root/.githooks/pre-push"; do
  bash -n "$script"
done
for script in "$root"/scripts/git/test-*.py "$root"/scripts/migration/test-*.py "$root"/deploy/lightsail/test-*.py; do
  step python3 -B "$script"
done
step bash "$root/deploy/lightsail/test-restore-docker.sh"
step npm run format:check
step npm run lint
step npm run db:generate
step npm test
step npm run test:integration
# These suites share a port and generated files, so run them sequentially.
step npm run test:e2e
step npm run test:e2e:freeze
# Restore normal Next route types after the browser server used .next-e2e.
step npm run typecheck
step npm run build
if [[ -n "${WORKBOOK_FIXTURE_DIR:-}" ]]; then
  report_dir=$(mktemp -d)
  trap 'rm -f "$report_dir/compatibility.json"; rmdir "$report_dir"' EXIT
  step npm run test:compatibility -- "$WORKBOOK_FIXTURE_DIR" "$report_dir/compatibility.json"
fi
echo 'All V2 pre-push checks passed.'
