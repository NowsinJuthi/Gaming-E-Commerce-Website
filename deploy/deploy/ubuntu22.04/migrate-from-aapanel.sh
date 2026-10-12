#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0 [source-directory]" >&2; exit 1; }
SOURCE_DIR="$(readlink -f "${1:-$(pwd)}")"
TARGET_DIR=/opt/uniqbd.com
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "$SOURCE_DIR/package.json" ]] || {
  echo "No UniQbd package.json found in $SOURCE_DIR" >&2
  exit 1
}

"$SCRIPT_DIR/install-prerequisites.sh"

echo "==> Migrating application files to $TARGET_DIR"
API_ENV="$TARGET_DIR/apps/api/.env"
WEB_ENV="$TARGET_DIR/apps/web/.env.local"
LEGACY_API_ENV=/etc/uniqbd/api.env
LEGACY_WEB_ENV=/etc/uniqbd/web.env

rsync -a --delete \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='apps/api/.env' \
  --exclude='apps/web/.env.local' \
  --exclude='apps/web/.env.production' \
  --exclude='apps/web/.env.production.local' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='dist/' \
  --exclude='.turbo/' \
  --exclude='uploads/' \
  "$SOURCE_DIR/" "$TARGET_DIR/"
chown -R uniqbd:uniqbd "$TARGET_DIR"

install -d -o uniqbd -g uniqbd -m 0755 "$TARGET_DIR/apps/api" "$TARGET_DIR/apps/web"

if [[ ! -f "$API_ENV" ]]; then
  if [[ -f "$LEGACY_API_ENV" ]]; then
    install -o uniqbd -g uniqbd -m 0640 "$LEGACY_API_ENV" "$API_ENV"
  elif [[ -f "$SOURCE_DIR/apps/api/.env" ]]; then
    install -o uniqbd -g uniqbd -m 0640 "$SOURCE_DIR/apps/api/.env" "$API_ENV"
  elif [[ -f "$SOURCE_DIR/.env" ]]; then
    install -o uniqbd -g uniqbd -m 0640 "$SOURCE_DIR/.env" "$API_ENV"
  else
    install -o uniqbd -g uniqbd -m 0640 \
      "$TARGET_DIR/deploy/deploy/ubuntu22.04/api.env.example" "$API_ENV"
  fi
fi
if [[ ! -f "$WEB_ENV" ]]; then
  if [[ -f "$LEGACY_WEB_ENV" ]]; then
    install -o uniqbd -g uniqbd -m 0640 "$LEGACY_WEB_ENV" "$WEB_ENV"
  elif [[ -f "$SOURCE_DIR/apps/web/.env.local" ]]; then
    install -o uniqbd -g uniqbd -m 0640 "$SOURCE_DIR/apps/web/.env.local" "$WEB_ENV"
  elif [[ -f "$SOURCE_DIR/apps/web/.env.production.local" ]]; then
    install -o uniqbd -g uniqbd -m 0640 \
      "$SOURCE_DIR/apps/web/.env.production.local" "$WEB_ENV"
  else
    install -o uniqbd -g uniqbd -m 0640 \
      "$TARGET_DIR/deploy/deploy/ubuntu22.04/web.env.example" "$WEB_ENV"
  fi
fi

upsert_env() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}
upsert_env "$API_ENV" API_HOST 127.0.0.1
upsert_env "$API_ENV" API_PORT 4000
upsert_env "$API_ENV" UPLOADS_DIR /opt/uniqbd.com/uploads

if [[ -d "$SOURCE_DIR/uploads" ]]; then
  echo "==> Migrating persistent uploads"
  rsync -a "$SOURCE_DIR/uploads/" /opt/uniqbd.com/uploads/
  chown -R uniqbd:uniqbd /opt/uniqbd.com/uploads
fi

if ! "$TARGET_DIR/deploy/deploy/ubuntu22.04/deploy.sh"; then
  echo "Native deployment failed." >&2
  exit 1
fi

clean_public_root() {
  local root="$1"
  [[ "$root" == /www/wwwroot/uniqbd.com || "$root" == /www/wwwroot/api.uniqbd.com ]] ||
    return 1
  for item in \
    apps packages deploy scripts node_modules uploads .git .next dist .turbo \
    package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc \
    .env .env.local .env.production.local deploy-manifest.json; do
    rm -rf -- "$root/$item"
  done
  install -d -m 0755 "$root/.well-known"
  printf '%s\n' 'UniQbd is served by systemd from /opt/uniqbd.com.' >"$root/index.html"
}

echo "==> Removing application files from aaPanel public webroots"
clean_public_root /www/wwwroot/uniqbd.com
clean_public_root /www/wwwroot/api.uniqbd.com

"$TARGET_DIR/deploy/deploy/ubuntu22.04/verify.sh"

echo "Native migration completed."
