#!/usr/bin/env bash
set -euo pipefail
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
current=$(git -C "$root" config --get core.hooksPath || true)
if [[ -n "$current" && "$current" != .githooks ]]; then
  echo "Existing hooksPath is $current. Integrate .githooks/pre-push with your hooks before changing it." >&2
  exit 1
fi
if [[ -z "$current" && -f "$root/.git/hooks/pre-push" ]]; then
  echo 'An existing .git/hooks/pre-push must be integrated before installing this hook.' >&2
  exit 1
fi
chmod +x "$root/.githooks/pre-push"
git -C "$root" config --local core.hooksPath .githooks
echo 'Installed V2 pre-push checks for this checkout.'
