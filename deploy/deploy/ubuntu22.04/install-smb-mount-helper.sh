#!/usr/bin/env bash
# One-time setup: let the website API mount Samba and play the file in place.
#   sudo bash /opt/uniqbd.com/deploy/deploy/ubuntu22.04/install-smb-mount-helper.sh

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash /opt/uniqbd.com/deploy/deploy/ubuntu22.04/install-smb-mount-helper.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER_SRC="${SCRIPT_DIR}/uniqbd-mount-smb.sh"
HELPER_DST="/usr/local/bin/uniqbd-mount-smb"
SUDOERS_FILE="/etc/sudoers.d/uniqbd-smb-mount"
API_USER="${UNIQBD_API_USER:-uniqbd}"
UNIT="/etc/systemd/system/uniqbd-api.service"

if [[ ! -f "$HELPER_SRC" ]]; then
  echo "Missing ${HELPER_SRC}" >&2
  exit 1
fi

if ! id "$API_USER" >/dev/null 2>&1; then
  echo "API user not found: ${API_USER}" >&2
  exit 1
fi

if ! command -v mount.cifs >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y cifs-utils
fi

install -m 755 -o root -g root "$HELPER_SRC" "$HELPER_DST"
printf '%s ALL=(root) NOPASSWD: %s\n' "$API_USER" "$HELPER_DST" >"$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
if ! visudo -cf "$SUDOERS_FILE"; then
  rm -f "$SUDOERS_FILE"
  echo "Invalid sudoers entry." >&2
  exit 1
fi

MOUNT_ROOT="/opt/uniqbd.com/uploads/smb-mounts"
mkdir -p "${MOUNT_ROOT}/.credentials"
chown -R "${API_USER}:${API_USER}" "$MOUNT_ROOT"

if [[ -f "$UNIT" ]] && grep -q '^NoNewPrivileges=true' "$UNIT"; then
  sed -i 's/^NoNewPrivileges=true/NoNewPrivileges=false/' "$UNIT"
  systemctl daemon-reload
fi

echo "Samba mount helper installed. The API can play movies directly from the share."
