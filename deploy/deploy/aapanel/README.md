# UniQbd — aaPanel Production Deploy

Domains:

| Service | Domain | Internal port | PM2 name |
|---------|--------|---------------|----------|
| Next.js (website) | `https://uniqbd.com` | `3000` | `uniqbd-web` |
| NestJS (API) | `https://api.uniqbd.com` | `4000` | `uniqbd-api` |

Install path: `/www/wwwroot/uniqbd.com`

---

## 1. DNS

| Type | Name | Value |
|------|------|-------|
| A | `@` | VPS IP |
| A | `www` | VPS IP |
| A | `api` | VPS IP |

Cloudflare: SSL mode **Full (strict)**.

---

## 2. aaPanel dependencies

- Nginx
- Node.js 20+
- PM2: `npm i -g pm2`
- MongoDB 7 (or Atlas)
- Redis 7
- pnpm: `corepack enable && corepack prepare pnpm@9.12.0 --activate`

---

## 3. Upload code

```bash
cd /www/wwwroot/uniqbd.com
bash deploy/deploy/aapanel/post-upload.sh
```

Or step by step:

```bash
cd /www/wwwroot/uniqbd.com
corepack pnpm install --frozen-lockfile
```

Do **not** copy `node_modules` from Windows.

---

## 4. Environment

```bash
cp deploy/deploy/aapanel/.env.production.example .env
nano .env

cp deploy/deploy/aapanel/web.env.production.example apps/web/.env.production.local
nano apps/web/.env.production.local
```

```bash
mkdir -p uploads/{avatars,logos,products,banners}
chown -R www:www uploads
```

---

## 5. Build

```bash
corepack pnpm build
```

---

## 6. PM2

```bash
pm2 delete all 2>/dev/null || true
pm2 start deploy/deploy/aapanel/ecosystem.config.cjs
pm2 save
pm2 startup
pm2 status
```

Verify:

```bash
curl -I http://127.0.0.1:3000
curl -s http://127.0.0.1:4000/api/health
```

---

## 7. aaPanel websites + nginx

### uniqbd.com

1. **Website → Add site** → `uniqbd.com` + `www.uniqbd.com`
2. **SSL → Let's Encrypt**
3. **Config** → paste `deploy/deploy/aapanel/nginx/uniqbd.com.aapanel-full.conf`

### api.uniqbd.com

1. **Website → Add site** → `api.uniqbd.com`
2. **SSL → Let's Encrypt**
3. **Config** → paste `deploy/deploy/aapanel/nginx/api.uniqbd.com.aapanel-full.conf`

Health:

- `https://api.uniqbd.com/api/health`
- `https://api.uniqbd.com/api/health/ready`

---

## 8. First-time users

```bash
corepack pnpm seed:users
```

Default admin: `admin@uniqbd.com` / `Admin1234!`

Skip `pnpm seed` if categories/products already exist.

---

## 9. Update / redeploy

**Always use the redeploy script** (not `pm2 restart` alone):

```bash
cd /www/wwwroot/uniqbd.com
bash deploy/deploy/aapanel/redeploy.sh
```

This script cleans caches, forces a full build, kills ghost processes on ports 3000/4000, starts PM2, and **verifies** the live `buildId` matches the new build. It exits with an error if deploy failed.

Verify from anywhere:

```bash
curl -s https://uniqbd.com/api/deploy-info
# buildId must match: cat apps/web/.next/BUILD_ID on the server
```

Diagnostics:

```bash
bash deploy/deploy/aapanel/verify-live.sh
```

### Upload checklist (Windows → aaPanel)

1. Zip **only**: `apps/`, `deploy/`, `packages/`, `scripts/`, root config files (`package.json`, `pnpm-lock.yaml`, etc.)
2. **Never** upload `node_modules`, `.next`, `dist`, `.turbo`, or `.env`
3. Extract into `/www/wwwroot/uniqbd.com` — files must **not** sit in a nested subfolder
4. Run `bash deploy/deploy/aapanel/redeploy.sh`
5. Confirm `https://uniqbd.com/api/deploy-info` shows the new `buildId`

Local helper: `node scripts/package-for-upload.mjs`

`post-upload.sh` runs the same redeploy script.

---

## File map

```
deploy/deploy/aapanel/
├── .env.production.example      → /www/wwwroot/uniqbd.com/.env
├── web.env.production.example   → apps/web/.env.production.local
├── ecosystem.config.cjs         → PM2 (uniqbd-api + uniqbd-web)
├── redeploy.sh                  → **use this after every upload** (clean build + verify)
├── verify-live.sh               → read-only diagnostics
├── write-deploy-manifest.cjs    → writes deploy-manifest.json after build
├── post-upload.sh               → calls redeploy.sh
├── setup.sh                     → env templates + uploads dirs
├── nginx/
│   ├── uniqbd.com.conf
│   ├── uniqbd.com.aapanel-full.conf
│   ├── api.uniqbd.com.conf
│   └── api.uniqbd.com.aapanel-full.conf
└── README.md
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Permission denied` on `apps/web/.next` | PM2 ran as `www` — `sudo rm -rf apps/web/.next` or use updated `rebuild-web.sh` |
| Next build very slow | You deleted `.next` (cold build). Use `bash deploy/deploy/aapanel/rebuild-web.sh` without `rm -rf .next` — keeps webpack cache (~2–5 min vs 10+ min on VPS). Full clean only: `CLEAN_BUILD=1 bash deploy/deploy/aapanel/rebuild-web.sh` |
| `Cannot POST .../sms-logs/bulk-delete` | **Web updated but API not rebuilt.** Run `bash deploy/deploy/aapanel/rebuild-api.sh` (not web-only). Verify: probe should be 401/400, not 404. |
| `pm2` / `corepack` not found in SSH | Use aaPanel **Terminal** (root) or run deploy scripts (load aaPanel Node path). Install: `npm i -g pm2` |
| Script fails with `$'\r': command not found` | Windows CRLF — run `bash deploy/deploy/aapanel/fix-shell-crlf.sh` then `redeploy.sh` |
| Web errored | `pm2 logs uniqbd-web` — rebuild if needed |
| Admin login shows "Access denied" | Account lacks `admin` role — run `corepack pnpm seed:users` (default `admin@uniqbd.com` / `Admin1234!`) or `node apps/api/scripts/promote-admin.cjs your@email.com`, then log out and log in again |
| Chat broken / WebSocket ERR_NAME_NOT_RESOLVED | Add nginx `/socket.io/` on **uniqbd.com** (see `nginx/uniqbd.com.conf`); rebuild web — sockets use same-origin, not `api.uniqbd.com` |
| Uploads 404 / images missing | Copy local `uploads/` to `/www/wwwroot/uniqbd.com/uploads`; set `UPLOADS_DIR`; nginx `/api/uploads/` → port 4000 |
| Live site shows old content after admin changes | Admin header → **Publish** (clears API cache + Next.js cache). Wait ~1 min or hard refresh (Ctrl+Shift+R) |
| DB still has old brand/domain strings | `node deploy/deploy/aapanel/migrate-legacy-brand.cjs` (runs automatically in `post-upload.sh`) |
| Live site shows old **code** after upload | Run `bash deploy/deploy/aapanel/redeploy.sh` — never rely on upload alone or `pm2 restart` |
| Need to confirm deploy worked | `curl -s https://uniqbd.com/api/deploy-info` — `buildId` must match `cat apps/web/.next/BUILD_ID` on server |
| Cloudflare still shows old pages | Cloudflare dashboard → Caching → **Purge Everything** (or Development Mode on while testing) |

### Site still looks old after build + restart

```bash
cd /www/wwwroot/uniqbd.com
bash deploy/deploy/aapanel/verify-live.sh
bash deploy/deploy/aapanel/redeploy.sh
```

Common root causes:

| Cause | How redeploy.sh fixes it |
|-------|--------------------------|
| Ghost Node process on :3000 (old site) | `fuser -k` on 3000/4000 before start |
| Turbo skipped build (cached) | `TURBO_FORCE=true` + deletes `.turbo` |
| Wrong PM2 cwd / legacy `amarpin-*` apps | Deletes all known PM2 names, fresh start |
| Zip extracted into nested folder | Validates `package.json` name and required paths |
| Upload missing `packages/` | Checks `packages/types/package.json` exists |
| Build failed silently | Requires `BUILD_ID` + `dist/main.js`; compares live `/api/deploy-info` |

**Two kinds of “changes”**

1. **Admin panel** (logo, menus, settings, products) → Save + **Publish** (+ hard refresh).
2. **Code** (Footer, CSS, new features) → upload source + `pnpm build` + restart **`uniqbd-web`**.
