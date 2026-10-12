#!/usr/bin/env bash
# Quick MongoDB connection test on VPS.
# Usage: cd /opt/uniqbd.com && bash deploy/deploy/ubuntu22.04/tools/test-db.sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

API_ENV="$ROOT/apps/api/.env"
if [ ! -f "$API_ENV" ] && [ -f /etc/uniqbd/api.env ]; then
  API_ENV=/etc/uniqbd/api.env
fi
if [ ! -f "$API_ENV" ]; then
  echo "ERROR: $ROOT/apps/api/.env is missing"
  exit 1
fi

echo "==> Server public IP (add this in MongoDB Atlas → Network Access):"
curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || echo "(could not detect)"
echo ""

echo "==> MONGODB_URI set?"
if grep -q '^MONGODB_URI=.' "$API_ENV"; then
  echo "YES (value hidden)"
else
  echo "NO — add MONGODB_URI to $ROOT/apps/api/.env"
  exit 1
fi

echo "==> Testing MongoDB connection..."
cd apps/api
node "$ROOT/deploy/deploy/ubuntu22.04/tools/test-db.cjs"
