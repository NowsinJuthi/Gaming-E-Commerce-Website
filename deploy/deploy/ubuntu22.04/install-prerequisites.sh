#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0" >&2; exit 1; }
source /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "22.04" ]] || {
  echo "This installer supports Ubuntu 22.04 LTS only." >&2
  exit 1
}

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg build-essential iproute2 rsync lsb-release

node_major=0
if [[ -x /usr/bin/node ]]; then
  node_major="$(/usr/bin/node -p "Number(process.versions.node.split('.')[0])")"
fi
if (( node_major < 20 )); then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
/usr/bin/node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a<20||(a===20&&b<11)) process.exit(1)" || {
  echo "Node.js 20.11 or newer is required." >&2
  exit 1
}

corepack enable
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PNPM_SPEC="$(/usr/bin/node -p "require('$REPO_ROOT/package.json').packageManager")"
[[ "$PNPM_SPEC" == pnpm@* ]] || {
  echo "package.json must pin packageManager to pnpm@<version>" >&2
  exit 1
}
corepack prepare "$PNPM_SPEC" --activate

install -d -m 0755 /usr/share/keyrings
if [[ ! -f /usr/share/keyrings/redis-archive-keyring.gpg ]]; then
  curl -fsSL https://packages.redis.io/gpg |
    gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
fi
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb ${VERSION_CODENAME} main" \
  >/etc/apt/sources.list.d/redis.list
apt-get update
apt-get install -y redis

redis_conf=/etc/redis/redis.conf
if [[ -f "$redis_conf" ]]; then
  sed -ri 's/^[#[:space:]]*bind .*/bind 127.0.0.1 ::1/' "$redis_conf"
  sed -ri 's/^[#[:space:]]*protected-mode .*/protected-mode yes/' "$redis_conf"
fi
systemctl enable --now redis-server
redis-cli -h 127.0.0.1 ping | grep -qx PONG || {
  echo "Native Redis health check failed." >&2
  exit 1
}

if ! id uniqbd >/dev/null 2>&1; then
  useradd --system --home-dir /opt/uniqbd --create-home --shell /usr/sbin/nologin uniqbd
fi

install -d -o uniqbd -g uniqbd -m 0755 \
  /opt/uniqbd/current \
  /opt/uniqbd/uploads \
  /opt/uniqbd/uploads/avatars \
  /opt/uniqbd/uploads/banners \
  /opt/uniqbd/uploads/live-chat \
  /opt/uniqbd/uploads/logos \
  /opt/uniqbd/uploads/mfs-qr \
  /opt/uniqbd/uploads/products
install -d -o root -g uniqbd -m 0750 /etc/uniqbd

for domain in uniqbd.com api.uniqbd.com; do
  install -d -m 0755 "/www/wwwroot/$domain/.well-known"
  if [[ ! -f "/www/wwwroot/$domain/index.html" ]]; then
    printf '%s\n' 'UniQbd is served by the native application service.' \
      >"/www/wwwroot/$domain/index.html"
  fi
done

echo "Prerequisites installed. aaPanel Nginx was not installed or replaced."
