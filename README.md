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
| `deploy/deploy/ubuntu22.04/` | Native Ubuntu/systemd production deploy |
| `deploy/deploy/aapanel/` | aaPanel domain, SSL, and Nginx proxy config |
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

**API essentials:** `MONGODB_URI`, `UPLOADS_DIR` (absolute path, e.g.
`D:/uniqbd.com/uploads` in local development), and JWT secrets.

### 3. Redis (optional in dev)

Run a local Redis service on `127.0.0.1:6379`. Development can use the
application's in-memory fallbacks; production requires native Redis.

### 4. Database & seed

```bash
pnpm db:setup          # indexes
pnpm db:setup:full     # indexes + sample catalog
pnpm seed:users        # default admin account
```

`seed:users` does not contain default credentials. Set `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` (at least 14 characters) in the command environment.
Optionally set `SEED_DEMO_EMAIL` and `SEED_DEMO_PASSWORD` for a local demo user.
Never reuse these values in production or commit them.

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

## Production hosting

Production uses native Ubuntu 22.04 services. The application runs directly
under systemd; aaPanel is used only for domains, SSL, and Nginx reverse proxying.

- source/builds: `/opt/uniqbd/current`
- uploads: `/opt/uniqbd/uploads`
- API env: `/etc/uniqbd/api.env`
- web env: `/etc/uniqbd/web.env`
- process manager: systemd (`uniqbd-api`, `uniqbd-web`)
- database: MongoDB Atlas
- queue/cache/realtime: native Redis on `127.0.0.1:6379`
- edge: aaPanel manages domains, SSL, HTTPS redirects, and Nginx only

Application source and secrets must never be placed in aaPanel public webroots.

Full guides:

- [Native Ubuntu installation and deployment](deploy/deploy/ubuntu22.04/README.md)
- [aaPanel domain, SSL, and Nginx setup](deploy/deploy/aapanel/README.md)

Deploy or update:

```bash
sudo /opt/uniqbd/current/deploy/deploy/ubuntu22.04/deploy.sh
sudo VERIFY_PUBLIC=1 /opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh
```

The systemd services are enabled at installation and automatically start after
a future reboot. They restart on process failure. Deployment does not reboot
the server.

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
| Uploads 404 | Confirm `UPLOADS_DIR=/opt/uniqbd/uploads`, ownership `uniqbd:uniqbd`, and Nginx `/api/uploads/` proxy |
| Service failed | `journalctl -u uniqbd-api -u uniqbd-web -n 100 --no-pager` |
| Old site after upload | Run `/opt/uniqbd/current/deploy/deploy/ubuntu22.04/deploy.sh` |
| Live diagnostics | Run `/opt/uniqbd/current/deploy/deploy/ubuntu22.04/verify.sh` |

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
pnpm seed:users       # Explicitly configured admin / optional demo user
```

---

## Production deployment map

```
deploy/deploy/
├── ubuntu22.04/
│   ├── install-prerequisites.sh  → Node, pnpm, Redis, user/directories
│   ├── migrate-from-aapanel.sh   → one-time filesystem migration
│   ├── deploy.sh                 → frozen install, build, systemd, health
│   ├── rebuild-api.sh            → API-only build and systemd restart
│   ├── rebuild-web.sh            → web-only build and systemd restart
│   ├── verify.sh                 → service, bind, webroot and health checks
│   ├── api.env.example
│   ├── web.env.example
│   └── systemd/                  → native API and web units
└── aapanel/
    └── nginx/                    → aaPanel SSL/reverse-proxy configs
```

---

<p align="center">
  <sub>UniQbd · Digital goods marketplace for Bangladesh · BDT · Built with Next.js &amp; NestJS</sub>
</p>
