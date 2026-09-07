#!/usr/bin/env bash
# Read-only diagnostics when live site looks stale.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/verify-live.sh

if command -v sed >/dev/null 2>&1 && grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$ROOT"

echo "=== UniQbd live deploy diagnostics ==="
echo "Root: $ROOT"
echo ""

echo "--- 1. Project structure ---"
for req in package.json apps/web/package.json apps/api/package.json packages/types/package.json; do
  if [ -f "$req" ]; then echo "  OK  $req"; else echo "  MISSING  $req"; fi
done

if [ -f uniqbd.com/package.json ]; then
  echo "  WARN nested uniqbd.com/ folder — extract zip incorrectly"
fi

echo ""
echo "--- 2. PM2 ---"
pm2 status 2>/dev/null || echo "pm2 not running"

echo ""
pm2 describe uniqbd-web 2>/dev/null | grep -E 'status|cwd|script path' || echo "uniqbd-web not in PM2"

echo ""
echo "--- 3. Ports ---"
ss -tlnp 2>/dev/null | grep -E ':3000|:4000' || netstat -tlnp 2>/dev/null | grep -E ':3000|:4000' || echo "cannot list ports"

echo ""
echo "--- 4. Build artifacts ---"
if [ -f apps/web/.next/BUILD_ID ]; then
  echo "  file BUILD_ID: $(cat apps/web/.next/BUILD_ID)"
else
  echo "  MISSING apps/web/.next/BUILD_ID — run redeploy.sh"
fi

if [ -f apps/api/dist/main.js ]; then
  echo "  OK  apps/api/dist/main.js"
  if grep -q 'sms-logs/bulk-delete' apps/api/dist/modules/mfs/mfs.controller.js 2>/dev/null; then
    echo "  OK  SMS log delete route in API dist"
  else
    echo "  MISSING SMS delete in API dist — run: bash deploy/deploy/aapanel/rebuild-api.sh"
  fi
  if grep -q 'blocksAdminTelegramForPendingOrder' apps/api/dist/modules/notifications/order-notification-policy.js 2>/dev/null; then
    echo "  OK  pending-order notification guards in API dist"
  else
    echo "  MISSING pending notification guards — run: bash deploy/deploy/aapanel/rebuild-api.sh"
  fi
else
  echo "  MISSING apps/api/dist/main.js"
fi

if [ -f deploy-manifest.json ]; then
  echo "  manifest: $(cat deploy-manifest.json)"
else
  echo "  no deploy-manifest.json"
fi

echo ""
echo "--- 5. Live localhost (bypass browser cache) ---"
curl -sf http://127.0.0.1:3000/api/deploy-info 2>/dev/null || echo "  FAIL http://127.0.0.1:3000/api/deploy-info"
echo ""
curl -sf -o /dev/null -w "  homepage HTTP %{http_code}\n" http://127.0.0.1:3000/ 2>/dev/null || echo "  homepage FAILED"
curl -sf -o /dev/null -w "  api health HTTP %{http_code}\n" http://127.0.0.1:4000/api/health 2>/dev/null || echo "  api health FAILED"
SMS_DEL_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  http://127.0.0.1:4000/api/payments/admin/mfs/sms-logs/bulk-delete \
  -H 'Content-Type: application/json' \
  -d '{"ids":[]}' 2>/dev/null || echo '000')"
echo "  sms bulk-delete POST HTTP $SMS_DEL_CODE (401/400=route OK, 404=API not rebuilt)"

echo ""
echo "--- 6. Public site ---"
curl -sf https://uniqbd.com/api/deploy-info 2>/dev/null || curl -sf http://uniqbd.com/api/deploy-info 2>/dev/null || echo "  cannot reach uniqbd.com/api/deploy-info"

echo ""
echo "Fix: bash deploy/deploy/aapanel/redeploy.sh"
