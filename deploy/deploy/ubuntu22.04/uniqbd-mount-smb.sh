#!/usr/bin/env bash
# Root-only CIFS mount so the website can play a Samba movie in place.
# Usage:
#   uniqbd-mount-smb MOUNT_ID HOST SHARE CRED_FILE MOUNT_ROOT [PORT]

set -euo pipefail

MOUNT_ID="${1:?mount id}"
HOST="${2:?smb host}"
SHARE="${3:?share name}"
CRED_FILE="${4:?credentials file}"
MOUNT_ROOT="${5:?mount root}"
PORT="${6:-445}"

if [[ ! "$MOUNT_ID" =~ ^[a-fA-F0-9]{24}(-[A-Za-z0-9._-]{1,64})?$ ]]; then
  echo "Invalid mount id." >&2
  exit 1
fi

if [[ "$HOST" == */* || "$SHARE" == */* || "$HOST" == *\\* || "$SHARE" == *\\* ]]; then
  echo "Host and share must not contain path separators." >&2
  exit 1
fi

if [[ ! -f "$CRED_FILE" ]]; then
  echo "Credentials file not found." >&2
  exit 1
fi

resolve_dir() {
  mkdir -p "$1"
  readlink -f "$1"
}

ROOT="$(resolve_dir "$MOUNT_ROOT")"
MP="$(resolve_dir "${MOUNT_ROOT}/${MOUNT_ID}")"
CRED_REAL="$(readlink -f "$CRED_FILE")"
CRED_DIR="$(resolve_dir "${ROOT}/.credentials")"

if [[ "$MP" != "$ROOT"/* ]]; then
  echo "Mount point must stay under the mount root." >&2
  exit 1
fi

if [[ "$CRED_REAL" != "$CRED_DIR"/* ]]; then
  echo "Credentials file must stay under the mount root." >&2
  exit 1
fi

if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "cifs-utils is required. Install it with: apt-get install -y cifs-utils" >&2
  exit 1
fi

if mountpoint -q "$MP" 2>/dev/null; then
  echo "Already mounted: $MP"
  exit 0
fi

SOURCE="//${HOST}/${SHARE}"
if [[ "$PORT" != "445" && -n "$PORT" ]]; then
  SOURCE="${SOURCE}:${PORT}"
fi

API_USER="${UNIQBD_API_USER:-uniqbd}"
if ! id "$API_USER" >/dev/null 2>&1; then
  echo "API user not found: ${API_USER}" >&2
  exit 1
fi
API_UID="$(id -u "$API_USER")"
API_GID="$(id -g "$API_USER")"
BASE_OPTS="credentials=${CRED_REAL},uid=${API_UID},gid=${API_GID},iocharset=utf8,file_mode=0664,dir_mode=0775,noserverino,sec=ntlmssp,cache=loose,actimeo=60"

for vers in 3.0 3.1.1 2.1; do
  if mount -t cifs "$SOURCE" "$MP" -o "${BASE_OPTS},vers=${vers}" 2>/dev/null; then
    echo "Mounted ${SOURCE} -> ${MP} (vers=${vers})"
    exit 0
  fi
done

if mount -t cifs "$SOURCE" "$MP" -o "$BASE_OPTS"; then
  echo "Mounted ${SOURCE} -> ${MP}"
  exit 0
fi

echo "Mount failed for ${SOURCE} -> ${MP}" >&2
exit 1
