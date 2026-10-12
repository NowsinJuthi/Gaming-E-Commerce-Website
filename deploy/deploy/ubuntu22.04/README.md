# UniQbd native Ubuntu 22.04 deployment

This is the canonical production deployment. **aaPanel** is used only for
**`uniqbd.com` / `www.uniqbd.com` / `api.uniqbd.com`** — domain binding, Let's
Encrypt SSL, HTTP→HTTPS, and Nginx reverse proxy to loopback.

**Ubuntu (native):** Node.js 20, pnpm builds, systemd (`uniqbd-web`,
`uniqbd-api`), Redis, MongoDB Atlas client, all application source, **uploads**,
and **`.env` files** under **`/opt/uniqbd.com`** (not in aaPanel webroots, not
under `/etc/uniqbd`, no `current/` subfolder).

**Fresh VPS checklist:** [NEW-SERVER-SETUP.md](./NEW-SERVER-SETUP.md)

MongoDB production data is hosted on Atlas. Redis is a native local Ubuntu
service. BullMQ processors run inside the NestJS API, so there is no separate
worker service.

## Server layout

| Path | Purpose |
|------|---------|
| `/opt/uniqbd.com/` | Full repo: `apps/`, `deploy/`, builds |
| `/opt/uniqbd.com/uploads/` | All file uploads (images, chat attachments, logos, …) |
| `/opt/uniqbd.com/apps/api/.env` | API configuration and secrets |
| `/opt/uniqbd.com/apps/web/.env.local` | Storefront URLs and `INTERNAL_API_URL` |
| `/www/wwwroot/uniqbd.com/` | aaPanel: `.well-known` + placeholder only |
| `/www/wwwroot/api.uniqbd.com/` | aaPanel: `.well-known` + placeholder only |

Chat **text** is stored in MongoDB; chat **images** under `uploads/live-chat/`.

## 1. Place the release

**New server (git):**

```bash
sudo git clone <repo-url> /opt/uniqbd.com
cd /opt/uniqbd.com
find deploy -name '*.sh' -exec sed -i 's/\r$//' {} +
sudo bash deploy/deploy/ubuntu22.04/install-prerequisites.sh
sudo bash deploy/deploy/ubuntu22.04/setup-env.sh
sudoedit apps/api/.env
sudoedit apps/web/.env.local
sudo bash deploy/deploy/ubuntu22.04/deploy.sh
```

Then configure aaPanel domains, SSL, and Nginx — see
[../aapanel/README.md](../aapanel/README.md) and [NEW-SERVER-SETUP.md](./NEW-SERVER-SETUP.md).

**Upload tarball to a staging dir**, then migrate:

```bash
cd /opt/uniqbd.com/incoming   # or any path with package.json
sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh "$PWD"
```

For the first migration from the old aaPanel webroot:

```bash
cd /www/wwwroot/uniqbd.com
sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh "$PWD"
```

The migration copies application files to `/opt/uniqbd.com`, moves uploads
to `/opt/uniqbd.com/uploads` (same layout as local `uploads/`), migrates existing env files when present, builds
and verifies native services, then removes only known UniQbd application paths
from the two aaPanel webroots. It does not create a backup.

If templates were installed because no existing env files were found, edit:

```bash
sudoedit /opt/uniqbd.com/apps/api/.env
sudoedit /opt/uniqbd.com/apps/web/.env.local
```

`MONGODB_URI` must be the production Atlas URI. Keep Atlas network access and
credentials restricted to this server. Generate fresh JWT/encryption values
where templates say `REPLACE_WITH_*`.

### Already on `/opt/uniqbd/current` (old layout)

Move the live tree to the domain-style root (no `current/` folder):

```bash
sudo systemctl stop uniqbd-web uniqbd-api
sudo rsync -a /opt/uniqbd/current/ /opt/uniqbd.com/
# If uploads were under /var/lib/uniqbd/uploads:
sudo rsync -a /var/lib/uniqbd/uploads/ /opt/uniqbd.com/uploads/
sudo chown -R uniqbd:uniqbd /opt/uniqbd.com
sudo sed -i 's|^UPLOADS_DIR=.*|UPLOADS_DIR=/opt/uniqbd.com/uploads|' /opt/uniqbd.com/apps/api/.env
# If env was only under /etc/uniqbd/, copy once then deploy (deploy.sh migrates automatically):
# sudo install -o uniqbd -g uniqbd -m 0640 /etc/uniqbd/api.env /opt/uniqbd.com/apps/api/.env
# sudo install -o uniqbd -g uniqbd -m 0640 /etc/uniqbd/web.env /opt/uniqbd.com/apps/web/.env.local
cd /opt/uniqbd.com
sudo -u uniqbd git pull origin main   # when using git deploy
find deploy -name '*.sh' -exec sed -i 's/\r$//' {} +
sudo bash deploy/deploy/ubuntu22.04/deploy.sh
```

Update aaPanel Nginx includes if they still point at `/opt/uniqbd/current/...`, then
`nginx -t && systemctl reload nginx`. You can remove `/opt/uniqbd/current` after
verify passes.

## 2. Native prerequisites

The prerequisite installer:

- verifies Ubuntu 22.04 LTS;
- installs Node.js 20 LTS, build tools, Corepack, and pinned pnpm 9.12.0;
- installs Redis from the official Redis packages and binds it to loopback;
- creates the non-root `uniqbd` system user;
- creates `/opt/uniqbd.com` and `/opt/uniqbd.com/uploads`;
- does not install or replace aaPanel Nginx.

Run it independently when needed:

```bash
sudo bash deploy/deploy/ubuntu22.04/install-prerequisites.sh
```

## 3. Deploy updates

Synchronize the new release into `/opt/uniqbd.com` without overwriting
`apps/api/.env`, `apps/web/.env.local`, `node_modules`, build output, or
uploads, then:

```bash
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/deploy.sh
```

The deploy installs frozen dependencies, builds API and web, installs systemd
units, runs `systemctl daemon-reload`, enables and starts both services, and
fails if local health checks do not pass. Next.js public variables are loaded
from `apps/web/.env.local` at build time.

For a deliberate partial rebuild:

```bash
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-api.sh
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-web.sh
```

Use the full `deploy.sh` after dependency, shared-package, or deployment
configuration changes.

Operational database/upload diagnostics are under `tools/`; they load
`apps/api/.env` automatically and are not part of aaPanel.

## 4. systemd and reboot behavior

```bash
systemctl is-enabled uniqbd-api uniqbd-web redis-server
systemctl is-active uniqbd-api uniqbd-web redis-server
systemctl status uniqbd-api uniqbd-web
journalctl -u uniqbd-api -f
journalctl -u uniqbd-web -f
```

`uniqbd-api.service` and `uniqbd-web.service` use `Restart=on-failure` and are
enabled for `multi-user.target`. They start automatically after a future reboot
and restart after crashes. Do not reboot merely to test deployment.

## 5. aaPanel proxy and SSL

Follow [`../aapanel/README.md`](../aapanel/README.md). Use aaPanel's existing
Nginx; do not install a second Nginx. Only ports 80/443 should be publicly
reachable. The app and Redis bind to loopback:

```text
127.0.0.1:3000  Next.js
127.0.0.1:4000  NestJS
127.0.0.1:6379  Redis
```

There is no local MongoDB listener when Atlas is used. If UFW is active, keep
3000, 4000, 6379, and 27017 denied from public ingress.

Set `TRUST_PROXY_HOPS=1` in `apps/api/.env`. Nginx must include
`deploy/deploy/aapanel/nginx/cloudflare-real-ip.conf` so `$remote_addr` is the
Cloudflare visitor, not the edge. After orange-clouding, enable
`cloudflare-origin-allow.conf` (or Authenticated Origin Pulls) so attackers
cannot hit origin with a fake `CF-Connecting-IP`. See
[`../aapanel/README.md`](../aapanel/README.md).

## 6. Health checks

```bash
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/verify.sh
sudo VERIFY_PUBLIC=1 /opt/uniqbd.com/deploy/deploy/ubuntu22.04/verify.sh

curl -f http://127.0.0.1:3000/
curl -f http://127.0.0.1:3000/api/deploy-info
curl -f http://127.0.0.1:4000/api/health
```

## 7. Rollback

Keep the previous release outside public webroots, for example
`/opt/uniqbd/releases/<release-id>`. To roll back:

```bash
sudo systemctl stop uniqbd-web uniqbd-api
sudo rsync -a --delete \
  --exclude=node_modules --exclude=.next --exclude=dist \
  /opt/uniqbd/releases/<release-id>/ /opt/uniqbd.com/
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/deploy.sh
```

Uploads and environment files are not rolled back with application code; they
remain in `/opt/uniqbd.com/uploads`, `apps/api/.env`, and `apps/web/.env.local`.
If rollback health checks
fail, inspect `journalctl` before changing Nginx or SSL.
