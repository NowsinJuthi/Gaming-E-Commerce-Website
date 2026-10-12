# CSP `style-src-attr 'unsafe-inline'` residual

`style-src` is nonce-based and does **not** include `'unsafe-inline'` in
production. React `style={{}}` still emits HTML style attributes, so
`style-src-attr 'unsafe-inline'` remains.

It cannot be removed until every remaining usage below is replaced with CSS
classes, CSS variables set without attributes, or nonce-protected `<style>`
tags.

## Remaining categories

- Admin charts and Redis graphs
- Email live preview / branding swatches
- Appearance theme color pickers
- Rich-text editor color chips
- Review and SEO score meters
- Staggered `animationDelay` on admin settings and marketing pages
- `opengraph-image.tsx` / `icon.tsx` (ImageResponse, not browser CSP)
- `global-error.tsx` standalone error page

Injected `<style>` tags without a nonce stay blocked. XSS cannot use this
directive to execute script.
