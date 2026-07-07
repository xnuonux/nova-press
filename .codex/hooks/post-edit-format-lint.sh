#!/usr/bin/env bash
set -euo pipefail
# read JSON from stdin, extract the file path
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
if [[ -z "$file" || ! -f "$file" ]]; then exit 0; fi
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.mjs|*.css)
    npx prettier --write "$file" > /dev/null 2>&1 || true
    npx eslint --fix "$file" > /dev/null 2>&1 || true
    ;;
esac
exit 0
