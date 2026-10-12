# UniQbd native Ubuntu 22.04 deployment

This is the canonical production deployment. aaPanel manages only domains,
certificates, HTTPS redirects, and Nginx reverse proxy configuration. Node.js,
Redis, builds, processes, uploads, and environment files live outside public
webroots.

MongoDB production data is hosted on Atlas. Redis is a native local Ubuntu
service. BullMQ processors run inside the NestJS API, so there is no separate
worker service.

## 1. Place the release

Upload/extract the repository to a temporary non-public directory such as
`/opt/uniqbd/incoming`, then run:

```bash
cd /opt/uniqbd/incoming
sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh "$PWD"
```

For the first migration from the old aaPanel webroot:

```bash
cd /www/wwwroot/uniqbd.com
sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh "$PWD"
```

The migration copies application files to `/opt/uniqbd/current`, moves uploads
to `/opt/uniqbd/uploads`, migrates existing env files when present, builds
and verifies native services, then removes only known UniQbd application paths
from the two aaPanel webroots. It does not create a backup.

If templates were installed because no existing env files were found, edit:

```bash
sudoedit /etc/uniqbd/api.env
sudoedit /etc/uniqbd/web.env
```

`MONGODB_URI` must be the production Atlas URI. Keep Atlas network access and
credentials restricted to this server. Generate fresh JWT/encryption values
where templates say `REPLACE_WITH_*`.

## 2. Native prerequisites

The prerequisite installer:

- verifies Ubuntu 22.04 LTS;
- installs Node.js 20 LTS, build tools, Corepack, and pinned pnpm 9.12.0;
- installs Redis from the official Redis packages and binds it to loopback;
- creates the non-root `uniqbd` system user;
- creates `/opt/uniqbd/current`, `/opt/uniqbd/uploads`, and `/etc/uniqbd`;
- does not install or replace aaPanel Nginx.

Run it independently when needed:

```bash
sudo bash deploy/deploy/ubuntu22.04/install-prerequisites.sh
```

## 3. Deploy updates

Synchronize the new release into `/opt/uniqbd/current` without `.env`,
`node_modules`, build output, or uploads, then:

```bash
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/deploy.sh
```

The deploy installs frozen dependencies, builds API and web, installs systemd
units, runs `systemctl daemon-reload`, enables and starts both services, and
fails if local health checks do not pass. Next.js public variables are loaded
from `/etc/uniqbd/web.env` at build time.

For a deliberate partial rebuild:

```bash
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/rebuild-api.sh
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/rebuild-web.sh
```

Use the full `deploy.sh` after dependency, shared-package, or deployment
configuration changes.

Operational database/upload diagnostics are under `tools/`; they load
`/etc/uniqbd/api.env` automatically and are not part of aaPanel.

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

Set `TRUST_PROXY_HOPS=1` in `/etc/uniqbd/api.env`. Nginx must include
`deploy/deploy/aapanel/nginx/cloudflare-real-ip.conf` so `$remote_addr` is the
Cloudflare visitor, not the edge. After orange-clouding, enable
`cloudflare-origin-allow.conf` (or Authenticated Origin Pulls) so attackers
cannot hit origin with a fake `CF-Connecting-IP`. See
[`../aapanel/README.md`](../aapanel/README.md).

## 6. Health checks

```bash
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh
sudo VERIFY_PUBLIC=1 /opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh

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
  /opt/uniqbd/releases/<release-id>/ /opt/uniqbd/current/
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/deploy.sh
```

Uploads and environment files are not rolled back with application code; they
remain in `/opt/uniqbd/uploads` and `/etc/uniqbd`. If rollback health checks
fail, inspect `journalctl` before changing Nginx or SSL.
