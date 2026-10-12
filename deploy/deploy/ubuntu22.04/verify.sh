#!/usr/bin/env bash
set -Eeuo pipefail

fail() { echo "FAILED: $*" >&2; exit 1; }
pass() { echo "OK: $*"; }

for service in uniqbd-api uniqbd-web; do
  systemctl is-enabled --quiet "$service" ||
    fail "$service is not enabled for boot"
  systemctl is-active --quiet "$service" ||
    fail "$service is not active"
  pass "$service enabled and active"
done

systemctl is-enabled --quiet redis-server || fail "redis-server is not enabled"
systemctl is-active --quiet redis-server || fail "redis-server is not active"
redis-cli -h 127.0.0.1 ping | grep -qx PONG || fail "Redis ping failed"
pass "native Redis enabled, active and reachable"

curl -fsS --max-time 10 http://127.0.0.1:3000/ >/dev/null ||
  fail "web localhost health failed"
curl -fsS --max-time 10 http://127.0.0.1:3000/api/deploy-info >/dev/null ||
  fail "web deploy-info failed"
curl -fsS --max-time 10 http://127.0.0.1:4000/api/health >/dev/null ||
  fail "API localhost health failed"
pass "web, deploy-info and API health endpoints"

for port in 3000 4000 6379; do
  if ss -lntH "sport = :$port" |
    awk '{print $4}' |
    grep -Evq '^(\[::1\]|127\.0\.0\.1):'; then
    ss -lntp "sport = :$port" || true
    fail "port $port is listening on a non-loopback address"
  fi
  pass "port $port is loopback-only"
done

for root in /www/wwwroot/uniqbd.com /www/wwwroot/api.uniqbd.com; do
  for marker in apps packages node_modules package.json pnpm-lock.yaml .env .git; do
    [[ ! -e "$root/$marker" ]] ||
      fail "application/source marker remains in public webroot: $root/$marker"
  done
  pass "$root contains no application source markers"
done

if [[ "${VERIFY_PUBLIC:-0}" == "1" ]]; then
  curl -fsS --max-time 20 https://uniqbd.com/ >/dev/null ||
    fail "public storefront HTTPS check failed"
  curl -fsS --max-time 20 https://api.uniqbd.com/api/health >/dev/null ||
    fail "public API HTTPS check failed"
  pass "public HTTPS domains"
else
  echo "SKIP: public HTTPS checks (run with VERIFY_PUBLIC=1 on the VPS)"
fi
