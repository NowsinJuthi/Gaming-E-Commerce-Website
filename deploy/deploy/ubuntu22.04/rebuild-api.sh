#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/uniqbd.com
[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0" >&2; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "Missing $APP_DIR/package.json" >&2; exit 1; }
[[ -f "$APP_DIR/apps/api/.env" ]] || { echo "Missing $APP_DIR/apps/api/.env" >&2; exit 1; }

cd "$APP_DIR"
chown -R uniqbd:uniqbd "$APP_DIR/apps/api"
runuser -u uniqbd -- env HOME=/opt/uniqbd.com \
  corepack pnpm --filter @uniqbd/api build
[[ -f "$APP_DIR/apps/api/dist/main.js" ]] || {
  echo "API build did not create dist/main.js" >&2
  exit 1
}

systemctl restart uniqbd-api.service
echo "Waiting for API on port 4000..."
for ((i=1; i<=45; i++)); do
  if curl -fsS --max-time 5 http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "API rebuild and restart successful."
    exit 0
  fi
  sleep 2
done

journalctl -u uniqbd-api.service -n 80 --no-pager || true
echo "API health check failed after rebuild." >&2
exit 1
