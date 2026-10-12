# UniQbd security audit

Date: 2026-10-12 (HttpOnly access-cookie / plaintext migration / live Mongo / CSP residual / payment recovery pass)  
Scope: `apps/web`, `apps/api`, `docs/`  
No secret values are recorded in this document. **This audit is not complete** while residuals below remain.

## Summary

| Severity | This pass | Residual |
|----------|-----------|----------|
| Critical | Unique-index / duplicate-charge / payment CAS fixes preserved | — |
| High | XSS JWT theft closed for browser sessions (HttpOnly access cookie; JSON omits tokens). Inventory included in encrypt migration. Historical Failed-superseded recovery script. | Same-origin XSS can still **session-ride**. Legacy plaintext **data** until `--apply`. nodemailer 8.x majors. |
| Medium | Live Mongo IDOR/authz tests. Provider-specific refund paths + confirmed-status check. Fail-closed counts include serial/PIN/manual cards. | sanitize-html 2.17.5 (Jest/ESM). |
| Low | CSP `style-src-attr` documented with regression tests | React `style={{}}` still requires `style-src-attr 'unsafe-inline'` |

Existing payment, authorization, CORS, sandbox, and production fail-closed fixes were **not** reverted.

## 1. XSS → refresh/access-token theft — **High — mitigated (HttpOnly cookies)**

- **Where:** `auth.controller.ts`, `auth-cookies.ts`, `jwt.strategy.ts`, `chat.gateway.ts`, `events.gateway.ts`, `chat.controller.ts`, `apps/web/src/lib/access-token.ts`, `api.ts`, sockets
- **Exploit (before):** Same-origin XSS read `window.__UNIQBD_GET_ACCESS_TOKEN` / in-memory JWT, or called `/auth/refresh` and stole the JSON `accessToken`.
- **Fix:** Browser sessions (requests with `Origin` or existing auth cookies) set HttpOnly / Secure (prod) / SameSite=Lax `uniqbd_access` (path `/`) and keep `uniqbd_refresh` (path `/api/auth`). JSON omits `accessToken` and `refreshToken`, returns public `csrfToken` only. JS `getAccessToken()` is always `null`. Socket.IO uses `withCredentials` and the access cookie. Programmatic clients **without** Origin still receive JSON tokens. CSRF on cookie refresh, rotation, guest checkout, multi-tab BroadcastChannel, and `tokenVersion` password-change revocation are preserved.
- **Remaining:** XSS on uniqbd.com can still make authenticated same-origin requests (session riding) and can read the CSRF value in `localStorage`. It **cannot** exfiltrate a usable JWT for another origin. Full BFF was not required once cookies + omit-secrets landed.

## 2. Legacy plaintext secret migration — **High — code complete; data until apply**

- **Where:** `encrypt-delivered-codes.cjs`, `plaintext-secrets.ts`, `plaintext-migrate.ts`, `plaintext-secrets.service.ts`, `docs/plaintext-migration.md`
- **Exploit:** Inventory `value`, delivered codes/serial/PIN, reseller codes, and manual gift cards stored as plaintext.
- **Fix:** Idempotent dry-run/apply script covers `inventory_items`, `orders`, and `reseller_orders`. Logs never print secret values. Production boot fail-closes unless `ALLOW_LEGACY_PLAINTEXT_SECRETS=true` (documented temporary hatch). Counts include serial, PIN, and manual cards.

## 3. Dependency vulnerabilities — **High/Medium — reduced, not gone**

- **Before:** 54 (1 critical, 29 high, 21 moderate, 3 low), including `proxy-addr` critical via Express 5.2.1.
- **After:** **11** (4 high, 7 moderate). Critical closed. Compatible overrides: proxy-addr, multer, ws, engine.io, socket.io-parser, body-parser, postcss, mongoose **8.24.1** (not 9), Next **15.5.27**, joi, sharp, qs, nanoid v3, js-yaml, brace-expansion v5, uuid v11.
- **Not upgraded:** nodemailer 8 → 10 (major), braces (no patched version), sanitize-html 2.17.7 (breaks Jest via ESM htmlparser2). See `docs/dependency-advisories.md`.

## 4. Live Mongo authorization / IDOR — **tests added**

- **Where:** `order-access.mongo.spec.ts` (`mongodb-memory-server`), plus existing unit helpers
- **Coverage:** missing order/payment IDs, foreign order and payment-intent IDOR, owner read, Support code redaction, MFS approve/config, refunds, secret writes, shop_manager vs Support, customer role-escalation denied. No production data.

## 5. CSP `style-src-attr 'unsafe-inline'` — **Low — residual**

- React `style={{}}` remains on charts, email preview, theme pickers, meters, animation delays, OG/icon image routes, and `global-error.tsx`.
- `style-src` stays nonce-based (no `'unsafe-inline'` when a nonce is present). Removing `style-src-attr` would break those UIs.
- Documented in `docs/csp-inline-styles.md`. Regression tests assert the residual directive.

## 6. Payment reconciliation residuals — **High — recovery + provider refunds**

- **Where:** `payment-superseded-recovery.ts`, `recover-superseded-payments.cjs`, `payment-gateway-refund.ts`, per-gateway `refundPath`, `base-payment.gateway.ts`
- **Exploit:** Historical `Failed` + `Superseded by a new checkout` dropped late captures. Generic `/refund` + pending-as-success was unsafe.
- **Fix:** Dry-run/apply reclaim of Failed leftovers that still have `gatewayRef` or `chargeLeaseUntil` → `superseded` so late captures enter unmatched recon. Provider-specific refund paths (bKash, Nagad, Rocket, Upay, UddoktaPay). MFS `supported: false`. Refunds require an explicit success/refunded status. Idempotent refunds, manual recon, amount/currency checks, and crash-safe settlement are unchanged.

## Tests added this pass

API: HttpOnly cookie flags + XSS probe (JWT not readable from JS storage/window); browser vs programmatic session split; plaintext planner + script secret-silence; fail-closed serial/PIN/manual; superseded recovery planner + script secret-silence; provider refund paths; live Mongo IDOR/authz.

Web: XSS `getAccessToken()` always null; cookie revalidate auth; CSP residual documentation.

## Commands run

| Command | Result |
|--------|--------|
| `corepack pnpm --filter @uniqbd/api test` | Pass — 38 suites, 137 tests (includes live Mongo) |
| `corepack pnpm --filter @uniqbd/web test -- --forceExit` | Pass — 7 suites, 21 tests |
| `corepack pnpm --filter @uniqbd/api exec tsc --noEmit` | Pass |
| `corepack pnpm --filter @uniqbd/web exec tsc --noEmit` | Pass |
| `corepack pnpm --filter @uniqbd/api build` | Pass |
| `corepack pnpm --filter @uniqbd/web build` | Pass (Next.js 15.5.27) |
| `corepack pnpm --filter @uniqbd/api lint` | Pass — 0 errors, 1 unused-disable warning |
| `corepack pnpm --filter @uniqbd/web lint` | Pass — 0 errors, 61 unused `eslint-disable` warnings |
| `corepack pnpm audit --prod` | **11** vulnerabilities (4 high, 7 moderate) |

Browser login/socket cookie handshake was not exercised against a running local stack in this pass (no interactive session). Closest substitutes: cookie unit tests, Web/API Jest, production Next build.

## Production / migration steps

1. Deploy API+web together: browsers will stop receiving JWTs in JSON. Reverse proxy must forward `Cookie` on `/api` and `/socket.io`.
2. Confirm `API_CORS_ORIGIN` allowlist and `credentials: true` (already required).
3. Mongo backup, then `corepack pnpm --filter @uniqbd/api migrate:encrypt-codes` (dry-run), then `node apps/api/scripts/encrypt-delivered-codes.cjs --apply`. Remove `ALLOW_LEGACY_PLAINTEXT_SECRETS` when counts are zero.
4. `node apps/api/scripts/recover-superseded-payments.cjs` then `--apply` for historical Failed leftovers that may still capture.
5. Restart API after migration. Production still fail-closes on leftover plaintext and on missing unique payment index.
6. No secrets were generated, printed, or committed.

## Unresolved risks

- Same-origin XSS can session-ride (cookies + CSRF in `localStorage`); it cannot steal the access JWT.
- `style-src-attr 'unsafe-inline'` remains for React inline styles.
- Plaintext codes remain in Mongo until operators run `--apply`.
- nodemailer 8.x, unpatched `braces`, sanitize-html 2.17.5 (see `docs/dependency-advisories.md`).
- Programmatic login without `Origin` still returns JWTs in JSON (intentional for non-browser clients).
- Full BFF (Next.js never sees the access JWT) was not implemented; HttpOnly cookies on the API host are the compatible equivalent behind the Next proxy.
