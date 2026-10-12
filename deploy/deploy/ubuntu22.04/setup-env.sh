#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/uniqbd.com
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ENV="${APP_DIR}/apps/api/.env"
WEB_ENV="${APP_DIR}/apps/web/.env.local"

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0" >&2; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || {
  echo "Missing $APP_DIR/package.json — clone the repo to /opt/uniqbd.com first." >&2
  exit 1
}
id uniqbd >/dev/null 2>&1 || {
  echo "Run install-prerequisites.sh first." >&2
  exit 1
}

install -d -o uniqbd -g uniqbd -m 0755 "$APP_DIR/apps/api" "$APP_DIR/apps/web"

if [[ -f "$API_ENV" ]]; then
  echo "Keep existing $API_ENV"
else
  install -o uniqbd -g uniqbd -m 0640 \
    "$SCRIPT_DIR/api.env.example" "$API_ENV"
  echo "Created $API_ENV from api.env.example"
fi

if [[ -f "$WEB_ENV" ]]; then
  echo "Keep existing $WEB_ENV"
else
  install -o uniqbd -g uniqbd -m 0640 \
    "$SCRIPT_DIR/web.env.example" "$WEB_ENV"
  echo "Created $WEB_ENV from web.env.example"
fi

echo ""
echo "Next: edit secrets, then deploy:"
echo "  sudoedit $API_ENV"
echo "  sudoedit $WEB_ENV"
echo "  sudo $APP_DIR/deploy/deploy/ubuntu22.04/deploy.sh"
