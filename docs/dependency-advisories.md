# Production `pnpm audit --prod` residuals

Compatible patches were applied via direct bumps and `pnpm.overrides`
(proxy-addr, multer, ws, engine.io, socket.io-parser, body-parser, postcss,
source-map-js, mongoose 8.24.1, qs, nanoid v3, browserslist, joi, sharp,
Next.js 15.5.27, js-yaml ≥4.3.2, brace-expansion v5, uuid v11).

Count after this pass: **11** (4 high, 7 moderate). Previously 54 including
1 critical.

The following were **not** force-upgraded:

| Package | Path | Why not upgraded | Exploitability | Plan |
|---|---|---|---|---|
| nodemailer | `apps/api` direct `^8.0.11` | Advisories patch in 9.x / 10.x | Untrusted `raw` / recipient parsing if attacker controls mail payload. SMTP is admin-configured. | Upgrade to nodemailer 10 after a mailer regression pass. |
| braces | nested via `@next/eslint-plugin-next` → micromatch | Advisory lists **no patched version** (`<0.0.0`) | Stack-exhaustion DoS on crafted globs at lint/build time, not the public request path. | Wait for micromatch/fast-glob. |
| sanitize-html | `apps/web` direct `2.17.5` | 2.17.7+ pulls ESM `htmlparser2@12`, which Jest 29 cannot load | SVG SMIL / `</textarea/>` allowedTags bypass. Storefront already strips scripts/handlers; CSP blocks inline script. | Upgrade with Jest ESM or a htmlparser2 CJS pin. |
