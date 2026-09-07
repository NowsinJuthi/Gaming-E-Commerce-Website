#!/usr/bin/env bash
# Rebuild NestJS API only — required when new API routes are added (e.g. SMS log delete).
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/rebuild-api.sh

if command -v sed >/dev/null 2>&1 && grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$ROOT"

log() { echo "==> $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# shellcheck source=env-path.sh
source "$SCRIPT_DIR/env-path.sh"

if ! command -v node >/dev/null 2>&1; then
  fail "node not found — install Node 20+ in aaPanel → App Store → Node.js"
fi
if ! command -v pm2 >/dev/null 2>&1; then
  fail "pm2 not found — run: npm i -g pm2"
fi

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

log "Building @uniqbd/api"
BUILD_START=$(date +%s)
corepack pnpm --filter @uniqbd/api build
BUILD_SEC=$(( $(date +%s) - BUILD_START ))
log "API build completed in ${BUILD_SEC}s"

if [ ! -f apps/api/dist/main.js ]; then
  fail "apps/api/dist/main.js missing after build"
fi

if ! grep -q 'sms-logs/bulk-delete' apps/api/dist/modules/mfs/mfs.controller.js 2>/dev/null; then
  fail "SMS delete route missing in dist — upload latest source before rebuild"
fi

log "Restarting uniqbd-api"
pm2 restart uniqbd-api 2>/dev/null || pm2 start deploy/deploy/aapanel/ecosystem.config.cjs --only uniqbd-api
pm2 save

sleep 3
API_CODE="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health || echo '000')"
DELETE_PROBE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  http://127.0.0.1:4000/api/payments/admin/mfs/sms-logs/bulk-delete \
  -H 'Content-Type: application/json' \
  -d '{"ids":[]}' || echo '000')"

echo ""
log "health: HTTP $API_CODE"
log "sms bulk-delete probe: HTTP $DELETE_PROBE (expect 401 or 400 — NOT 404)"
if [ "$DELETE_PROBE" = "404" ]; then
  fail "bulk-delete route still 404 — PM2 may be running old dist from another folder"
fi

log "SUCCESS — API restarted"
pm2 status
