# New VPS: Ubuntu 22.04 + aaPanel (UniQbd)

Use this checklist on a **fresh server**. aaPanel handles **only** `uniqbd.com` /
`www.uniqbd.com` / `api.uniqbd.com` (DNS in Cloudflare, SSL, Nginx proxy).
Everything else runs on Ubuntu: Node builds, systemd, Redis, uploads, `.env` files.

## Folder layout (single tree)

All site data lives under **`/opt/uniqbd.com`** — no `current/` subfolder, no
`/etc/uniqbd`, no app code in `/www/wwwroot`.

```text
/opt/uniqbd.com/
├── apps/                 Next.js + NestJS source and builds
├── packages/
├── deploy/
├── uploads/              All uploaded files (same as repo uploads/)
│   ├── products/
│   ├── logos/
│   ├── live-chat/        Chat image attachments (per room)
│   ├── avatars/
│   ├── banners/
│   ├── mfs-qr/
│   └── …
├── apps/api/.env         API secrets (Mongo, JWT, payments, UPLOADS_DIR, …)
└── apps/web/.env.local   Public URLs + INTERNAL_API_URL for Next.js

/www/wwwroot/uniqbd.com/       .well-known + placeholder only (aaPanel)
/www/wwwroot/api.uniqbd.com/   .well-known + placeholder only (aaPanel)
```

| Data | Where |
|------|--------|
| Product images, logos, MFS QR, chat **files** | `/opt/uniqbd.com/uploads/` |
| Chat **messages**, orders, users (text) | MongoDB Atlas |
| Queue / cache / Socket.IO scale-out | Redis on `127.0.0.1:6379` |

Set in API env: `UPLOADS_DIR=/opt/uniqbd.com/uploads`

---

## 1. Ubuntu prerequisites (root)

```bash
sudo apt update && sudo apt upgrade -y
# Install aaPanel separately if not already installed (official installer only).

sudo git clone https://github.com/NowsinJuthi/Gaming-E-Commerce-Website.git /opt/uniqbd.com
# Or upload/rsync your repo into /opt/uniqbd.com

cd /opt/uniqbd.com
find deploy -name '*.sh' -exec sed -i 's/\r$//' {} +
sudo bash deploy/deploy/ubuntu22.04/install-prerequisites.sh
sudo bash deploy/deploy/ubuntu22.04/setup-env.sh
sudoedit /opt/uniqbd.com/apps/api/.env
sudoedit /opt/uniqbd.com/apps/web/.env.local
```

**`apps/api/.env` must include:**

- `MONGODB_URI` — Atlas URI; add this VPS public IP in Atlas → Network Access
- `UPLOADS_DIR=/opt/uniqbd.com/uploads`
- `API_HOST=127.0.0.1`, `API_PORT=4000`
- Fresh `JWT_*`, `DATA_ENCRYPTION_KEY` (no `REPLACE_WITH_*`)
- `TRUST_PROXY_HOPS=1` when behind Cloudflare + aaPanel Nginx

**`apps/web/.env.local` (production):**

- `NEXT_PUBLIC_SITE_URL=https://uniqbd.com`
- `NEXT_PUBLIC_API_URL=https://api.uniqbd.com/api`
- `NEXT_PUBLIC_WS_URL=https://api.uniqbd.com`
- `INTERNAL_API_URL=http://127.0.0.1:4000/api`

Do **not** commit these files; `git pull` will not overwrite them.

---

## 2. aaPanel — domains and SSL only

1. **Website → Add site:** `uniqbd.com` (bind `www.uniqbd.com` on the same site).
2. **Website → Add site:** `api.uniqbd.com`.
3. **SSL** → Let's Encrypt for both sites (aaPanel manages renewal).
4. **Do not** use aaPanel Node/PM2/PHP for UniQbd.
5. **Website → Config** — replace vhost with repo templates (adjust `ssl_certificate`
   paths to match aaPanel cert paths if commented lines differ):
   - `deploy/deploy/aapanel/nginx/uniqbd.com.aapanel-full.conf`
   - `deploy/deploy/aapanel/nginx/api.uniqbd.com.aapanel-full.conf`

   Or paste the shorter include-ready snippets:
   - `nginx/uniqbd.com.conf`
   - `nginx/api.uniqbd.com.conf`

6. Before Cloudflare is orange-clouded, you may **comment out**
   `cloudflare-origin-allow.conf` in both vhosts for first tests; re-enable for production.

7. Test and reload:

```bash
sudo nginx -t && sudo nginx -s reload
```

Proxies: `uniqbd.com` → `127.0.0.1:3000`, `api.uniqbd.com` → `127.0.0.1:4000`.

---

## 3. Build and start (systemd)

```bash
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/deploy.sh
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/verify.sh
sudo VERIFY_PUBLIC=1 /opt/uniqbd.com/deploy/deploy/ubuntu22.04/verify.sh
```

Services: `uniqbd-web`, `uniqbd-api`, `redis-server` — enabled on boot.

---

## 4. Cloudflare DNS

| Name | Type | Content | Proxy |
|------|------|---------|-------|
| `@` | A | VPS IP | Proxied |
| `www` | CNAME | `uniqbd.com` | Proxied |
| `api` | A | VPS IP | Proxied |

Ensure vhosts include `cloudflare-real-ip.conf` and (production)
`cloudflare-origin-allow.conf`.

---

## 5. Updates after code changes

```bash
cd /opt/uniqbd.com
sudo -u uniqbd git pull origin main
find deploy -name '*.sh' -exec sed -i 's/\r$//' {} +
sudo bash deploy/deploy/ubuntu22.04/deploy.sh
```

Uploads and `.env` stay in place. Partial rebuilds:

```bash
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-api.sh
sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-web.sh
```

---

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| Site connection refused | `systemctl status uniqbd-web uniqbd-api nginx` |
| Uploads 404 | `UPLOADS_DIR`, `uniqbd:uniqbd` ownership on `uploads/` |
| API 502 | API on `127.0.0.1:4000`, `journalctl -u uniqbd-api -n 80` |
| Mongo errors | Atlas IP whitelist, `MONGODB_URI` in `apps/api/.env` |
| SSL | aaPanel cert paths in Nginx vhost |
| Admin upload **413** | Merge repo `uniqbd.com` nginx (`client_max_body_size 25g`, `location ^~ /api/admin/media-shares/` → `:4000`), `nginx -t && reload`. Files **>100MB** through **Cloudflare proxied** DNS still hit CF’s limit — use DNS-only (grey cloud) for upload tests or copy via Samba on LAN. |

More: [README.md](./README.md) · [aaPanel README](../aapanel/README.md)
