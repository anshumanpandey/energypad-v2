#!/usr/bin/env bash
set -euo pipefail
# No shell, file transfer, forwarding, or caller-controlled Docker arguments.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec sudo /usr/local/sbin/energiepad-deploy "${BASH_REMATCH[1]}"
fi
echo 'Only deploy <commit-sha> is permitted.' >&2
exit 2
