#!/usr/bin/env bash
# Run as root on VPS: sudo bash /opt/uniqbd.com/deploy/deploy/ubuntu22.04/git-pull.sh
set -euo pipefail

APP_DIR=/opt/uniqbd.com
BRANCH="${1:-main}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

id uniqbd >/dev/null 2>&1 || {
  echo "User uniqbd missing; run install-prerequisites.sh first." >&2
  exit 1
}

[[ -d "$APP_DIR/.git" ]] || {
  echo "Not a git checkout: $APP_DIR" >&2
  exit 1
}

# Root-owned .git/objects breaks `sudo -u uniqbd git pull`.
chown -R uniqbd:uniqbd "$APP_DIR/.git"
runuser -u uniqbd -- git -C "$APP_DIR" pull origin "$BRANCH"
echo "Git pull OK ($(runuser -u uniqbd -- git -C "$APP_DIR" rev-parse --short HEAD))"
