#!/usr/bin/env bash
set -euo pipefail
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf *"|*"git push --force"*|*"git push -f"*|*"git reset --hard"*|*"DROP TABLE"*|*"DROP DATABASE"*)
    echo "BLOCKED: destructive command refused by safety hook" >&2
    exit 2
    ;;
esac
exit 0
