#!/usr/bin/env bash
# Fix CRLF in deploy shell scripts after Windows upload.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/fix-shell-crlf.sh

# Self-fix CRLF so this script can run when uploaded from Windows zip
if command -v sed >/dev/null 2>&1 && grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  for f in "$(dirname "$0")"/*.sh; do
    if [ -f "$f" ]; then
      sed -i 's/\r$//' "$f"
    fi
  done
  exec bash "$0" "$@"
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
for f in "$DIR"/*.sh; do
  if [ -f "$f" ]; then
    sed -i 's/\r$//' "$f"
    echo "fixed: $f"
  fi
done
echo "Done. Now run: bash deploy/deploy/aapanel/redeploy.sh"
