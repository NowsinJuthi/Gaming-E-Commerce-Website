<p align="center">
  <strong>UniQbd</strong><br/>
  Bangladesh-focused digital goods marketplace — game top-ups, gift cards, vouchers &amp; instant delivery
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-%3E%3D20.11-339933?logo=node.js&logoColor=white" alt="Node 20+" />
  <img src="https://img.shields.io/badge/pnpm-9.12-F69220?logo=pnpm&logoColor=white" alt="pnpm 9" />
  <img src="https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/Currency-BDT-006A4E" alt="BDT" />
  <img src="https://img.shields.io/badge/License-Amarpin-6366f1" alt="Amarpin License" />
</p>

---

## Overview

**UniQbd** is a full-stack monorepo for selling digital products in Bangladesh. Customers can browse products, pay via **bKash / Nagad / Rocket / Upay / UddoktaPay**, receive codes instantly, and manage orders from a customer dashboard. Admins get a 40+ route control panel for catalog, payments, KYC, affiliates, resellers, live chat, SEO, and more.

| | |
|---|---|
| **Storefront** | Products, categories, brands, search, checkout, guest checkout |
| **Payments** | MFS gateways + SMS verification app + wallet |
| **Delivery** | Auto code delivery, manual fields, supplier integrations |
| **Accounts** | Customer, VIP, reseller, affiliate, supplier, support, admin |
| **Real-time** | Socket.IO chat + cache invalidation (no polling) |
| **License** | Amarpin feature gates — activate with **license key only** in admin |

---

## Architecture

```
Browser
   │
   ▼
Next.js 15  (port 3000)  ──REST──▶  NestJS 11 API  (port 4000/api)
   │                                      │
   │◀──────── Socket.IO /events ──────────┤
   │                                      ├── MongoDB 7
   │                                      ├── Redis 7  (BullMQ queues)
   │                                      └── uploads/  (product images, logos)
```

**Stack:** React 19 · TanStack Query · Zustand · Tailwind 3 · Mongoose 8 · BullMQ · Passport JWT · Socket.IO

---

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js storefront + full admin UI |
| `apps/api` | NestJS REST + WebSocket backend |
| `packages/types` | Shared TypeScript types |
| `packages/ui` | Shared UI scaffold |
| `packages/config-ts` | Shared TS configs |
| `packages/config-eslint` | Shared ESLint config |
| `deploy/deploy/aapanel/` | Production deploy (aaPanel, PM2, Nginx) |
| `uploads/` | Product images, logos, chat attachments |
| `scripts/` | Seed & diagnostic scripts |

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | ≥ 20.11 |
| pnpm | 9.12 (`corepack enable`) |
| MongoDB | 7.x (local or Atlas) |
| Redis | 7.x (required in production; optional in dev) |

---

## Local development

### 1. Clone & install

```bash
git clone <your-repo-url> uniqbd
cd uniqbd
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install
```

### 2. Environment

```bash
# Root + API (copy from examples, fill MongoDB URI)
cp .env.example .env          # if present, or use apps/api/.env

# Web
cp apps/web/.env.local.example apps/web/.env.local
```

**`apps/web/.env.local` (dev defaults):**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
INTERNAL_API_URL=http://127.0.0.1:4000/api
```

**API essentials:** `MONGODB_URI`, `UPLOADS_DIR` (absolute path, e.g. `D:/uniqbd.com/uploads`), JWT secrets.

### 3. Redis (optional in dev)

```bash
pnpm redis:up    # Docker Compose
pnpm redis:down
```

### 4. Database & seed

```bash
pnpm db:setup          # indexes
pnpm db:setup:full     # indexes + sample catalog
pnpm seed:users        # default admin account
```

Default admin: `admin@uniqbd.com` / `Admin1234!`

### 5. Run

```bash
pnpm dev          # web :3000 + api :4000
pnpm dev:web      # web only
pnpm dev:api      # api only
```

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger (dev) | http://localhost:4000/api/docs |

### 6. Other commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm seed
```

> **Dev license bypass:** When license is not configured and `NODE_ENV=development`, all licensed features are unlocked locally.

---

## Production hosting (aaPanel / VPS)

Detailed deploy docs: [`deploy/deploy/aapanel/README.md`](deploy/deploy/aapanel/README.md)

### Recommended setup

| Service | Domain | Internal port | PM2 name |
|---------|--------|---------------|----------|
| Next.js (website) | `https://uniqbd.com` | `3000` | `uniqbd-web` |
| NestJS (API) | `https://api.uniqbd.com` | `4000` | `uniqbd-api` |

**Install path:** `/www/wwwroot/uniqbd.com`

### Step-by-step

#### 1. DNS

| Type | Name | Value |
|------|------|-------|
| A | `@` | VPS IP |
| A | `www` | VPS IP |
| A | `api` | VPS IP |

Cloudflare: SSL mode **Full (strict)**.

#### 2. Server dependencies (aaPanel)

- Nginx
- Node.js 20+
- PM2: `npm i -g pm2`
- MongoDB 7 (local or MongoDB Atlas)
- Redis 7
- pnpm: `corepack enable && corepack prepare pnpm@9.12.0 --activate`

#### 3. Upload code

Upload **only source** — never `node_modules`, `.next`, `dist`, `.turbo`, or `.env`.

```bash
cd /www/wwwroot/uniqbd.com
bash deploy/deploy/aapanel/post-upload.sh
```

Or manually:

```bash
corepack pnpm install --frozen-lockfile
```

#### 4. Environment files

```bash
cp deploy/deploy/aapanel/.env.production.example .env
nano .env

cp deploy/deploy/aapanel/web.env.production.example apps/web/.env.production.local
nano apps/web/.env.production.local

mkdir -p uploads/{avatars,logos,products,banners,mfs-qr,live-chat}
chown -R www:www uploads
```

**Root `.env` highlights:**

| Variable | Example |
|----------|---------|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/uniqbd` or Atlas URI |
| `REDIS_HOST` | `127.0.0.1` |
| `UPLOADS_DIR` | `/www/wwwroot/uniqbd.com/uploads` |
| `JWT_ACCESS_SECRET` | random 48+ chars |
| `JWT_REFRESH_SECRET` | random 48+ chars |
| `DATA_ENCRYPTION_KEY` | 32-byte base64 |
| `API_PUBLIC_URL` | `https://api.uniqbd.com/api` |
| `APP_PUBLIC_URL` | `https://uniqbd.com` |

**`apps/web/.env.production.local`:**

```env
NEXT_PUBLIC_API_URL=https://api.uniqbd.com/api
NEXT_PUBLIC_WS_URL=https://api.uniqbd.com
NEXT_PUBLIC_SITE_URL=https://uniqbd.com
INTERNAL_API_URL=http://127.0.0.1:4000/api
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 5. License vendor config (one-time per deploy bundle)

Site secret ships with the app — **not** in MongoDB or admin UI.

```bash
cp apps/api/src/modules/license/license.vendor-config.example.ts \
   apps/api/src/modules/license/license.vendor-config.ts
# Edit siteSecret (+ websiteId if provided by Amarpin)
```

After deploy, admins activate at **Admin → Settings → License key** with the license key only.

#### 6. Build & PM2

```bash
corepack pnpm build

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
curl -s https://uniqbd.com/api/deploy-info
```

#### 7. Nginx (aaPanel)

**uniqbd.com**

1. Website → Add site → `uniqbd.com` + `www.uniqbd.com`
2. SSL → Let's Encrypt
3. Config → paste `deploy/deploy/aapanel/nginx/uniqbd.com.aapanel-full.conf`

**api.uniqbd.com**

1. Website → Add site → `api.uniqbd.com`
2. SSL → Let's Encrypt
3. Config → paste `deploy/deploy/aapanel/nginx/api.uniqbd.com.aapanel-full.conf`

Health checks:

- `https://api.uniqbd.com/api/health`
- `https://api.uniqbd.com/api/health/ready`

#### 8. First admin user

```bash
corepack pnpm seed:users
```

Then open **Admin → Settings → License key** and activate your Amarpin license.

### Redeploy after updates

**Always use the redeploy script** — not `pm2 restart` alone:

```bash
cd /www/wwwroot/uniqbd.com
bash deploy/deploy/aapanel/redeploy.sh
```

Confirm live build:

```bash
curl -s https://uniqbd.com/api/deploy-info
# buildId must match: cat apps/web/.next/BUILD_ID
```

---

## বাংলায় — হোস্টিং সংক্ষিপ্ত গাইড

### কী কী লাগবে

- VPS (aaPanel সহ) · Node 20+ · MongoDB · Redis · PM2 · Nginx
- ডোমেইন: `uniqbd.com` (ওয়েব) + `api.uniqbd.com` (API)

### দ্রুত ধাপ

1. কোড আপলোড করুন `/www/wwwroot/uniqbd.com`-এ (`node_modules` বাদ)
2. `.env` ও `apps/web/.env.production.local` সেট করুন
3. `license.vendor-config.ts`-এ site secret দিন (একবার)
4. `bash deploy/deploy/aapanel/redeploy.sh` চালান
5. aaPanel-এ Nginx কনফিগ পেস্ট করুন + SSL
6. `pnpm seed:users` → অ্যাডমিন লগইন → **License key** দিয়ে অ্যাক্টিভেট

### ডোমেইন / হোস্টিং / MongoDB বদলালে

নতুন সার্ভারে অ্যাপ ডিপ্লয় করুন (vendor-config সহ), তারপর অ্যাডমিন প্যানেলে **শুধু লাইসেন্স কী** দিয়ে Activate করুন — site secret আবার দিতে হবে না।

### দুই ধরনের পরিবর্তন

| ধরন | কী করতে হবে |
|-----|-------------|
| অ্যাডমিন প্যানেল (লোগো, প্রোডাক্ট, সেটিংস) | Save + **Publish** + hard refresh |
| কোড আপডেট (নতুন ফিচার, CSS) | কোড আপলোড + `redeploy.sh` |

---

## License system (Amarpin)

| Data | Stored in |
|------|-----------|
| License key | MongoDB `license_settings` |
| Site secret, product ID, API URL | `apps/api/src/modules/license/license.vendor-config.ts` |
| Validation cache | `UPLOADS_DIR/.amarpin-license-cache.json` |

**Licensed admin features:**

| Feature | Admin area |
|---------|------------|
| Payment gateways | `/admin/settings/payments` |
| Email / SMTP | `/admin/settings/email` |
| Customer panel & checkout | `/admin/settings/customer-panel` |
| Manual delivery fields | `/admin/settings/delivery` |
| Live chat settings | `/admin/chat/settings` |

Activate: **Admin → Settings → License key** → enter key → **Activate**

---

## Storefront routes

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/products`, `/[slug]` | Product listing & detail |
| `/category/*`, `/brand/*` | Browse by category / brand |
| `/search` | Search |
| `/checkout/*` | Checkout flow |
| `/dashboard`, `/cart`, `/orders` | Customer account |
| `/wallet`, `/wishlist`, `/chat`, `/tickets` | Wallet, wishlist, chat, support |
| `/affiliate`, `/reseller` | Partner portals |

## Admin routes (summary)

`/admin/*` — products, orders, payments, users, KYC, MFS, SEO, email, security, suppliers, settings, license, and 40+ more.

---

## API domains

Auth · Users · Products · Categories · Brands · Reviews · Search · Cart · Orders · Payments · MFS · Wallet · Delivery · Suppliers · Coupons · Vouchers · Notifications · Chat · Tickets · KYC · Affiliate · Reseller · Rewards · Wishlist · SEO · Contact · Admin · Security · RolePermissions · License

**Roles:** `customer` · `vip` · `reseller` · `affiliate` · `supplier` · `support` · `admin`

---

## Payment methods

| Method | Type |
|--------|------|
| bKash | MFS gateway + SMS verify |
| Nagad | MFS gateway + SMS verify |
| Rocket | MFS gateway |
| Upay | MFS gateway |
| UddoktaPay | Aggregator |
| Wallet | Internal balance |

Configure under **Admin → Settings → Payments** (requires license feature `paymentGateway`).

---

## Security notes (before git push)

**Never commit:**

- `.env`, `apps/api/.env`, `apps/web/.env.local`, `apps/web/.env.production.local`
- `license.vendor-config.ts` if it contains real site secrets (use `.example` template in repo)
- `uploads/` user content (unless intentionally public assets)
- `node_modules/`, `.next/`, `dist/`, `.turbo/`

**Always commit:**

- Source code (`apps/`, `packages/`, `deploy/`)
- `pnpm-lock.yaml`, `package.json`, configs
- `license.vendor-config.example.ts` (empty template)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Admin login "Access denied" | `pnpm seed:users` or `node apps/api/scripts/promote-admin.cjs you@email.com` |
| Chat / WebSocket broken | Nginx `/socket.io/` on main domain — see `deploy/deploy/aapanel/nginx/` |
| Uploads 404 | Set `UPLOADS_DIR`; copy `uploads/` folder; nginx `/api/uploads/` → port 4000 |
| Old site after upload | Run `bash deploy/deploy/aapanel/redeploy.sh`, not just `pm2 restart` |
| `$'\r': command not found` | Windows CRLF — `bash deploy/deploy/aapanel/fix-shell-crlf.sh` |
| Live diagnostics | `bash deploy/deploy/aapanel/verify-live.sh` |

Full troubleshooting table: [`deploy/deploy/aapanel/README.md`](deploy/deploy/aapanel/README.md)

---

## Project scripts reference

```bash
pnpm dev              # Start web + API (dev)
pnpm build            # Production build (all packages)
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
pnpm db:setup         # MongoDB indexes
pnpm db:setup:full    # Indexes + sample catalog
pnpm seed             # Seed catalog data
pnpm seed:users       # Default admin + test users
pnpm redis:up         # Start Redis (Docker)
```

---

## Production file map

```
deploy/deploy/aapanel/
├── .env.production.example       → copy to repo root .env
├── web.env.production.example    → apps/web/.env.production.local
├── ecosystem.config.cjs          → PM2 (uniqbd-api + uniqbd-web)
├── redeploy.sh                   → full clean build + verify (use after every upload)
├── verify-live.sh                → read-only diagnostics
├── post-upload.sh                → install + redeploy
├── setup.sh                      → env templates + upload dirs
└── nginx/                        → aaPanel nginx configs
```

---

<p align="center">
  <sub>UniQbd · Digital goods marketplace for Bangladesh · BDT · Built with Next.js &amp; NestJS</sub>
</p>
