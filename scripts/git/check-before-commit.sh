#!/usr/bin/env bash
# Check the web workspace without modifying or staging files.
set -eo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root/apps/web"
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -f "$nvm_script" ]]; then
    source "$nvm_script" --no-use
    nvm use 22
  fi
fi
set -u
fail() { echo "Pre-commit blocked: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail 'Install Node.js 22.12+.'
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' || fail 'Node.js 22.12+ is required.'
command -v npm >/dev/null 2>&1 || fail 'npm is required.'
[[ -d node_modules ]] || fail 'Run npm ci from apps/web first.'
trap 'echo "Pre-commit checks failed; commit cancelled. Fix the reported issues and retry." >&2' ERR
npm run format:check
npm run lint
echo 'Prettier and ESLint checks passed.'
