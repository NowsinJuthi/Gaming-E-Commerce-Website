#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/uniqbd.com
[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0" >&2; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "Missing $APP_DIR/package.json" >&2; exit 1; }
WEB_ENV="$APP_DIR/apps/web/.env.local"
[[ -f "$WEB_ENV" ]] || { echo "Missing $WEB_ENV" >&2; exit 1; }

systemctl stop uniqbd-web.service
rm -rf "$APP_DIR/apps/web/.next"
chown -R uniqbd:uniqbd "$APP_DIR/apps/web"

cd "$APP_DIR"
if ! runuser -u uniqbd -- env HOME=/opt/uniqbd.com bash -c \
  "set -a; source '$WEB_ENV'; set +a; exec corepack pnpm --filter @uniqbd/web build"; then
  echo "Web build failed; uniqbd-web remains stopped." >&2
  exit 1
fi
[[ -f "$APP_DIR/apps/web/.next/BUILD_ID" ]] || {
  echo "Web build did not create .next/BUILD_ID" >&2
  exit 1
}
install -d -o uniqbd -g uniqbd -m 0755 "$APP_DIR/apps/web/.next/cache"
runuser -u uniqbd -- env HOME=/opt/uniqbd.com \
  node "$APP_DIR/deploy/deploy/ubuntu22.04/tools/write-deploy-manifest.cjs"

systemctl restart uniqbd-web.service
echo "Waiting for web on port 3000..."
for ((i=1; i<=45; i++)); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/api/deploy-info >/dev/null 2>&1; then
    echo "Web rebuild and restart successful."
    exit 0
  fi
  sleep 2
done

journalctl -u uniqbd-web.service -n 80 --no-pager || true
echo "Web health check failed after rebuild." >&2
exit 1
