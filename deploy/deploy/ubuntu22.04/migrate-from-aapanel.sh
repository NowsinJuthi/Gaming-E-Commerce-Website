#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0 [source-directory]" >&2; exit 1; }
SOURCE_DIR="$(readlink -f "${1:-$(pwd)}")"
TARGET_DIR=/opt/uniqbd/current
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "$SOURCE_DIR/package.json" ]] || {
  echo "No UniQbd package.json found in $SOURCE_DIR" >&2
  exit 1
}

"$SCRIPT_DIR/install-prerequisites.sh"

echo "==> Migrating application files to $TARGET_DIR"
rsync -a --delete \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='apps/web/.env.production.local' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='dist/' \
  --exclude='.turbo/' \
  --exclude='uploads/' \
  "$SOURCE_DIR/" "$TARGET_DIR/"
chown -R uniqbd:uniqbd "$TARGET_DIR"

install -d -o root -g uniqbd -m 0750 /etc/uniqbd
if [[ ! -f /etc/uniqbd/api.env ]]; then
  if [[ -f "$SOURCE_DIR/.env" ]]; then
    install -o root -g uniqbd -m 0640 "$SOURCE_DIR/.env" /etc/uniqbd/api.env
  else
    install -o root -g uniqbd -m 0640 \
      "$TARGET_DIR/deploy/deploy/ubuntu22.04/api.env.example" /etc/uniqbd/api.env
  fi
fi
if [[ ! -f /etc/uniqbd/web.env ]]; then
  if [[ -f "$SOURCE_DIR/apps/web/.env.production.local" ]]; then
    install -o root -g uniqbd -m 0640 \
      "$SOURCE_DIR/apps/web/.env.production.local" /etc/uniqbd/web.env
  else
    install -o root -g uniqbd -m 0640 \
      "$TARGET_DIR/deploy/deploy/ubuntu22.04/web.env.example" /etc/uniqbd/web.env
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
upsert_env /etc/uniqbd/api.env API_HOST 127.0.0.1
upsert_env /etc/uniqbd/api.env API_PORT 4000
upsert_env /etc/uniqbd/api.env UPLOADS_DIR /opt/uniqbd/uploads

if [[ -d "$SOURCE_DIR/uploads" ]]; then
  echo "==> Migrating persistent uploads"
  rsync -a "$SOURCE_DIR/uploads/" /opt/uniqbd/uploads/
  chown -R uniqbd:uniqbd /opt/uniqbd/uploads
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
  printf '%s\n' 'UniQbd is served by systemd from /opt/uniqbd/current.' >"$root/index.html"
}

echo "==> Removing application files from aaPanel public webroots"
clean_public_root /www/wwwroot/uniqbd.com
clean_public_root /www/wwwroot/api.uniqbd.com

"$TARGET_DIR/deploy/deploy/ubuntu22.04/verify.sh"

echo "Native migration completed."
