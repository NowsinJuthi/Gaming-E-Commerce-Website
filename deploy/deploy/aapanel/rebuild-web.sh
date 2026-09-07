#!/usr/bin/env bash
# Rebuild Next.js only — stops BOTH PM2 apps, builds web, starts BOTH.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/rebuild-web.sh

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

clean_dir() {
  local target="$1"
  if rm -rf "$target" 2>/dev/null; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo rm -rf "$target"
    return 0
  fi
  fail "Cannot remove $target (permission denied). Run: sudo rm -rf $target"
}

if ! command -v node >/dev/null 2>&1; then
  fail "node not found — install Node 20+ in aaPanel → App Store → Node.js"
fi
if ! command -v pm2 >/dev/null 2>&1; then
  fail "pm2 not found — run: npm i -g pm2   (or use aaPanel Node terminal as root)"
fi

log "Stopping uniqbd-api and uniqbd-web"
pm2 stop uniqbd-api uniqbd-web 2>/dev/null || true

# Full .next wipe = cold build (often 5–15 min on VPS). Default: keep webpack cache.
if [ "${CLEAN_BUILD:-0}" = "1" ]; then
  log "CLEAN_BUILD=1 — removing apps/web/.next (slow cold build)"
  clean_dir apps/web/.next
else
  log "Keeping apps/web/.next cache (faster rebuild). For full clean: CLEAN_BUILD=1 bash $0"
fi

# Avoid Node OOM thrashing on small VPS (makes build feel “stuck”).
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

log "Building @uniqbd/web (84 routes — “Creating an optimized production build” may take several minutes)"
BUILD_START=$(date +%s)
corepack pnpm --filter @uniqbd/web build
BUILD_SEC=$(( $(date +%s) - BUILD_START ))
log "Web build completed in ${BUILD_SEC}s"

log "Starting uniqbd-api and uniqbd-web"
pm2 restart uniqbd-api uniqbd-web 2>/dev/null || \
  pm2 start deploy/deploy/aapanel/ecosystem.config.cjs

pm2 save

echo ""
log "SUCCESS — both apps running"
pm2 status
echo ""
echo "  curl -sL http://127.0.0.1:3000/api/deploy-info"
echo "  curl -s http://127.0.0.1:4000/api/health"
