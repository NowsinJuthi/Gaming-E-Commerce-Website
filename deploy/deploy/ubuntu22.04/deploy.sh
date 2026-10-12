#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/uniqbd/current
API_ENV=/etc/uniqbd/api.env
WEB_ENV=/etc/uniqbd/web.env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "==> $*"; }
[[ $EUID -eq 0 ]] || fail "Run as root: sudo $0"
[[ -f "$APP_DIR/package.json" ]] || fail "Missing $APP_DIR/package.json"
[[ -f "$APP_DIR/pnpm-lock.yaml" ]] || fail "Missing pnpm-lock.yaml"
[[ -f "$API_ENV" ]] || fail "Missing $API_ENV (copy api.env.example and fill secrets)"
[[ -f "$WEB_ENV" ]] || fail "Missing $WEB_ENV (copy web.env.example and edit it)"
id uniqbd >/dev/null 2>&1 || fail "User uniqbd is missing; run install-prerequisites.sh"
command -v corepack >/dev/null 2>&1 || fail "corepack is missing"
systemctl is-active --quiet redis-server || fail "redis-server is not active"

if grep -Eq '(^|=)REPLACE_WITH_|mongodb\+srv://USER:PASSWORD@CLUSTER' "$API_ENV"; then
  fail "$API_ENV still contains placeholder secrets or Atlas URI"
fi
grep -Eq '^API_HOST=127\.0\.0\.1$' "$API_ENV" ||
  fail "API_HOST must be 127.0.0.1 in $API_ENV"
grep -Eq '^UPLOADS_DIR=/var/lib/uniqbd/uploads$' "$API_ENV" ||
  fail "UPLOADS_DIR must be /var/lib/uniqbd/uploads in $API_ENV"

install -d -o uniqbd -g uniqbd -m 0755 /var/lib/uniqbd/uploads
chown -R uniqbd:uniqbd "$APP_DIR" /var/lib/uniqbd/uploads
chmod 0750 /etc/uniqbd
chown root:uniqbd "$API_ENV" "$WEB_ENV"
chmod 0640 "$API_ENV" "$WEB_ENV"

run_uniqbd() {
  runuser -u uniqbd -- env HOME=/opt/uniqbd "$@"
}

log "Installing frozen dependencies with repository-pinned pnpm"
cd "$APP_DIR"
PNPM_SPEC="$(node -p "require('$APP_DIR/package.json').packageManager")"
[[ "$PNPM_SPEC" == pnpm@* ]] || fail "package.json must pin packageManager to pnpm@<version>"
corepack prepare "$PNPM_SPEC" --activate
run_uniqbd corepack pnpm install --frozen-lockfile

systemctl stop uniqbd-web.service uniqbd-api.service 2>/dev/null || true
rm -rf "$APP_DIR/apps/api/dist" "$APP_DIR/apps/web/.next" "$APP_DIR/.turbo"

log "Building shared packages"
run_uniqbd corepack pnpm --filter @uniqbd/types build

log "Building API"
run_uniqbd corepack pnpm --filter @uniqbd/api build
[[ -f "$APP_DIR/apps/api/dist/main.js" ]] || fail "API build did not create dist/main.js"

log "Building Next.js with /etc/uniqbd/web.env"
grep '^NEXT_PUBLIC_' "$WEB_ENV" >"$APP_DIR/apps/web/.env.production"
chown uniqbd:uniqbd "$APP_DIR/apps/web/.env.production"
chmod 0640 "$APP_DIR/apps/web/.env.production"
runuser -u uniqbd -- env HOME=/opt/uniqbd bash -c \
  'set -a; source /etc/uniqbd/web.env; set +a; exec corepack pnpm --filter @uniqbd/web build'
[[ -f "$APP_DIR/apps/web/.next/BUILD_ID" ]] || fail "Web build did not create .next/BUILD_ID"
install -d -o uniqbd -g uniqbd -m 0755 "$APP_DIR/apps/web/.next/cache"
run_uniqbd node "$APP_DIR/deploy/deploy/ubuntu22.04/tools/write-deploy-manifest.cjs"

install -o root -g root -m 0644 \
  "$SCRIPT_DIR/systemd/uniqbd-api.service" /etc/systemd/system/uniqbd-api.service
install -o root -g root -m 0644 \
  "$SCRIPT_DIR/systemd/uniqbd-web.service" /etc/systemd/system/uniqbd-web.service

log "Enabling native services"
systemctl daemon-reload
systemctl enable --now uniqbd-api.service uniqbd-web.service

wait_for_url() {
  local name="$1" url="$2" attempts="${3:-30}"
  for ((i=1; i<=attempts; i++)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo "$name: OK"
      return 0
    fi
    sleep 2
  done
  journalctl -u "uniqbd-$name.service" -n 80 --no-pager || true
  fail "$name failed health check: $url"
}

wait_for_url api http://127.0.0.1:4000/api/health 45
wait_for_url web http://127.0.0.1:3000/ 45
wait_for_url web http://127.0.0.1:3000/api/deploy-info 15

log "Deployment successful"
systemctl --no-pager --full status uniqbd-api.service uniqbd-web.service
