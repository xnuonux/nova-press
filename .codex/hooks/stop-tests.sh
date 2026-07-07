#!/usr/bin/env bash
set -euo pipefail
# guard against infinite loop
if [[ "${CLAUDE_STOP_HOOK_ACTIVE:-}" == "1" ]]; then exit 0; fi
export CLAUDE_STOP_HOOK_ACTIVE=1
if [[ -f package.json ]] && grep -q '"test"' package.json; then
  pnpm test --silent || echo "tests failed, review before pushing" >&2
fi
exit 0
