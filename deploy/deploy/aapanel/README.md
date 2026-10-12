# aaPanel role in UniQbd production

aaPanel is used only for:

- `uniqbd.com`, `www.uniqbd.com`, and `api.uniqbd.com` domain management
- Let's Encrypt/SSL certificate management
- HTTP-to-HTTPS redirects
- Nginx reverse proxying to native systemd services

Application source, builds, dependencies, uploads, and secrets must not be stored
in aaPanel's public webroots.

## Filesystem boundaries

```text
/opt/uniqbd/current/              application source and builds
/var/lib/uniqbd/uploads/          persistent uploads
/etc/uniqbd/api.env               API secrets/configuration
/etc/uniqbd/web.env               frontend build/runtime configuration
/www/wwwroot/uniqbd.com/          .well-known and placeholder only
/www/wwwroot/api.uniqbd.com/      .well-known and placeholder only
```

The complete Ubuntu installation and deployment guide is at
[`../ubuntu22.04/README.md`](../ubuntu22.04/README.md).

## aaPanel setup

1. Add websites for `uniqbd.com` (including `www.uniqbd.com`) and
   `api.uniqbd.com`.
2. Issue certificates in aaPanel and keep certificate renewal under aaPanel.
3. Paste these complete vhost templates in Website → Config:
   - `nginx/uniqbd.com.aapanel-full.conf`
   - `nginx/api.uniqbd.com.aapanel-full.conf`
4. Test and reload aaPanel Nginx.

The storefront vhost proxies to `127.0.0.1:3000`; the API vhost proxies to
`127.0.0.1:4000`. Both include Socket.IO upgrade handling and standard proxy
headers. The storefront also proxies `/api/uploads/` and `/api/app/` to the API.

Do not configure aaPanel Node projects, PM2, PHP, or a second Nginx for UniQbd.
Run the application with systemd (see `../ubuntu22.04/README.md`).

## Public webroot safety

Only `.well-known/` and an optional static `index.html` placeholder belong in
the two webroots. The Nginx templates defensively deny dotfiles, environment
files, source trees, dependency trees, build metadata, keys, SQL dumps, and
source maps.

Run the native verification after changes:

```bash
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh
sudo VERIFY_PUBLIC=1 /opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh
```
