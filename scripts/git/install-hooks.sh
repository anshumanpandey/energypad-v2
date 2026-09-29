#!/usr/bin/env bash
set -euo pipefail
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
current=$(git -C "$root" config --get core.hooksPath || true)
if [[ -n "$current" && "$current" != .githooks ]]; then
  echo "Existing hooksPath is $current. Integrate .githooks/pre-commit and .githooks/pre-push with your hooks before changing it." >&2
  exit 1
fi
for hook in pre-commit pre-push; do
  if [[ -z "$current" && -f "$root/.git/hooks/$hook" ]]; then
    echo "An existing .git/hooks/$hook must be integrated before installing these hooks." >&2
    exit 1
  fi
done
chmod +x "$root/.githooks/pre-commit" "$root/.githooks/pre-push"
git -C "$root" config --local core.hooksPath .githooks
echo 'Installed V2 pre-commit and pre-push checks for this checkout.'
