#!/usr/bin/env bash
# Quick production prep on Linux VPS / aaPanel (run from repo root)
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "==> Creating uploads directories"
mkdir -p uploads/avatars uploads/logos uploads/products uploads/banners

if [ ! -f .env ]; then
  echo "==> Copying API .env template"
  cp deploy/deploy/aapanel/.env.production.example .env
  echo "    Edit .env — set JWT secrets, MongoDB, Redis, SMTP"
fi

WEB_ENV="$ROOT/apps/web/.env.production.local"
if [ ! -f "$WEB_ENV" ]; then
  echo "==> Copying web .env template"
  cp deploy/deploy/aapanel/web.env.production.example "$WEB_ENV"
fi

echo "==> Generating secret suggestions (paste into .env):"
echo "JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
echo "JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
echo "DATA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

echo ""
echo "Next steps:"
echo "  1. Edit .env and apps/web/.env.production.local"
echo "  2. bash deploy/deploy/aapanel/redeploy.sh"
echo "  3. Configure aaPanel nginx — see deploy/deploy/aapanel/README.md"
