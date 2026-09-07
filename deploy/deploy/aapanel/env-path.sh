#!/usr/bin/env bash
# aaPanel / VPS: put node, corepack, and pm2 on PATH for deploy scripts.
# Usage: source deploy/deploy/aapanel/env-path.sh

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# aaPanel Node.js (latest under nvm)
if [ -d /www/server/nvm/versions/node ]; then
  NODE_DIR="$(ls -d /www/server/nvm/versions/node/v[0-9]* 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "$NODE_DIR" ] && [ -d "$NODE_DIR/bin" ]; then
    export PATH="$NODE_DIR/bin:$PATH"
  fi
fi

# npm global bin (pm2 is often installed here)
for d in "$HOME/.npm-global/bin" /root/.npm-global/bin; do
  if [ -d "$d" ]; then
    export PATH="$d:$PATH"
  fi
done

if command -v corepack >/dev/null 2>&1; then
  corepack enable 2>/dev/null || true
fi
