#!/usr/bin/env bash
# Quick MongoDB connection test on VPS.
# Usage: cd /www/wwwroot/uniqbd.com && bash deploy/deploy/aapanel/test-db.sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env missing at $ROOT/.env"
  exit 1
fi

echo "==> Server public IP (add this in MongoDB Atlas → Network Access):"
curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || echo "(could not detect)"
echo ""

echo "==> MONGODB_URI set?"
if grep -q '^MONGODB_URI=.' .env; then
  echo "YES (value hidden)"
else
  echo "NO — add MONGODB_URI to .env"
  exit 1
fi

echo "==> Testing MongoDB connection..."
cd apps/api
node "$ROOT/deploy/deploy/aapanel/test-db.cjs"
