#!/usr/bin/env bash
# Run on VPS after uploading/extracting the project.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/post-upload.sh
DIR="$(cd "$(dirname "$0")" && pwd)"

# Windows zip / aaPanel upload often leaves CRLF — fix before running redeploy
if command -v sed >/dev/null 2>&1; then
  for f in "$DIR"/*.sh; do
    if [ -f "$f" ] && grep -q $'\r' "$f" 2>/dev/null; then
      sed -i 's/\r$//' "$f"
    fi
  done
fi

bash "$DIR/redeploy.sh"
