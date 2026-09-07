#!/usr/bin/env bash
# Bulletproof production redeploy for aaPanel / VPS.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/redeploy.sh

# Auto-fix Windows CRLF line endings (must run before set -euo pipefail)
if command -v sed >/dev/null 2>&1 && grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  for f in "$(dirname "$0")"/*.sh; do
    if [ -f "$f" ]; then
      sed -i 's/\r$//' "$f"
    fi
  done
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

log "UniQbd redeploy"
log "Root: $ROOT"

# --- 1. Validate install path (wrong folder = silent old site) ---
if [ ! -f "$ROOT/package.json" ]; then
  fail "package.json missing — are you in /www/wwwroot/uniqbd.com?"
fi

PKG_NAME="$(node -pe "JSON.parse(require('fs').readFileSync('package.json','utf8')).name" 2>/dev/null || echo '')"
if [ "$PKG_NAME" != "uniqbd" ]; then
  fail "package.json name is '$PKG_NAME' (expected uniqbd) — wrong project folder"
fi

for req in apps/web/package.json apps/api/package.json packages/types/package.json pnpm-lock.yaml; do
  if [ ! -f "$ROOT/$req" ]; then
    fail "missing $req — upload incomplete (need apps/, packages/, lockfile)"
  fi
done

# Nested zip extract guard (uniqbd.com/uniqbd.com/...)
if [ -f "$ROOT/uniqbd.com/package.json" ] || [ -f "$ROOT/apps/uniqbd.com/package.json" ]; then
  fail "nested project folder detected — extract zip so files sit directly in $ROOT"
fi

# --- 2. Env templates ---
WEB_ENV="$ROOT/apps/web/.env.production.local"
if [ ! -f "$WEB_ENV" ]; then
  log "Copying web env template"
  cp deploy/deploy/aapanel/web.env.production.example "$WEB_ENV"
fi

if [ ! -f "$ROOT/.env" ]; then
  echo "WARNING: .env missing — copy deploy/deploy/aapanel/.env.production.example to .env" >&2
fi

# --- 3. Uploads ---
mkdir -p uploads/avatars uploads/logos uploads/products uploads/banners
if id www >/dev/null 2>&1; then
  chown -R www:www uploads 2>/dev/null || true
fi

# --- 4. Stop PM2 + free ports (ghost processes are the #1 stale-site cause) ---
log "Stopping PM2 apps"
for name in amarpin-api amarpin-web uniqbd-api uniqbd-web; do
  pm2 delete "$name" 2>/dev/null || true
done

free_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 1
  fi
}

log "Freeing ports 3000 and 4000"
free_port 3000
free_port 4000

# --- 5. Clean build artifacts (turbo cache skip = old bundles) ---
if [ "${CLEAN_BUILD:-1}" = "1" ]; then
  log "Cleaning build caches (CLEAN_BUILD=1)"
  clean_dir apps/web/.next
  clean_dir apps/api/dist
  rm -rf .turbo node_modules/.cache 2>/dev/null || sudo rm -rf .turbo node_modules/.cache 2>/dev/null || true
else
  log "Skipping cache wipe (CLEAN_BUILD=0) — faster but use only when sure deploy is fresh"
  rm -rf node_modules/.cache 2>/dev/null || true
fi

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

# --- 6. Install + build ---
log "pnpm install"
corepack pnpm install --frozen-lockfile

log "pnpm build${TURBO_FORCE:+ (TURBO_FORCE=$TURBO_FORCE)}"
if [ "${TURBO_FORCE:-}" = "1" ] || [ "${TURBO_FORCE:-}" = "true" ]; then
  export TURBO_FORCE=true
fi
corepack pnpm build

# --- 7. Verify build output ---
if [ ! -f apps/web/.next/BUILD_ID ]; then
  fail "Next.js BUILD_ID missing after build"
fi
if [ ! -f apps/api/dist/main.js ]; then
  fail "API dist/main.js missing after build"
fi

BUILD_ID="$(cat apps/web/.next/BUILD_ID)"
log "Build ID: $BUILD_ID"

node deploy/deploy/aapanel/write-deploy-manifest.cjs

# --- 8. Start PM2 ---
log "Starting PM2"
pm2 start deploy/deploy/aapanel/ecosystem.config.cjs
pm2 save

# --- 9. Wait for processes ---
log "Waiting for services"
sleep 5

WEB_CODE="$(curl -sfL -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/deploy-info || echo '000')"
API_CODE="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health || echo '000')"

if [ "$WEB_CODE" != "200" ]; then
  fail "web on :3000 returned HTTP $WEB_CODE for /api/deploy-info — run: pm2 logs uniqbd-web --lines 50"
fi
if [ "$API_CODE" != "200" ]; then
  fail "api on :4000 returned HTTP $API_CODE — run: pm2 logs uniqbd-api --lines 50"
fi

# --- 10. Verify PM2 serves THIS build (not another process on :3000) ---
LIVE_BUILD_ID="$(curl -sfL http://127.0.0.1:3000/api/deploy-info | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).buildId" 2>/dev/null || echo '')"

if [ -z "$LIVE_BUILD_ID" ]; then
  fail "could not read /api/deploy-info — upload includes apps/web/src/app/api/deploy-info?"
fi

if [ "$LIVE_BUILD_ID" != "$BUILD_ID" ]; then
  echo "Port 3000 listener:" >&2
  ss -tlnp 2>/dev/null | grep ':3000' || true
  pm2 describe uniqbd-web 2>/dev/null | grep -E 'status|cwd|script path' || true
  fail "stale process on :3000 — file BUILD_ID=$BUILD_ID but live=$LIVE_BUILD_ID"
fi

log "Verified: live buildId matches $BUILD_ID"

# --- 11. Optional DB legacy brand migration ---
if [ -f deploy/deploy/aapanel/migrate-legacy-brand.cjs ]; then
  log "Legacy brand DB migration"
  node deploy/deploy/aapanel/migrate-legacy-brand.cjs || echo "WARNING: legacy brand migration failed" >&2
fi

echo ""
log "SUCCESS — redeploy complete"
echo "    buildId:    $BUILD_ID"
echo "    deployedAt: $(node -pe "JSON.parse(require('fs').readFileSync('deploy-manifest.json','utf8')).deployedAt")"
echo "    verify:     curl -s https://uniqbd.com/api/deploy-info"
echo ""
pm2 status
