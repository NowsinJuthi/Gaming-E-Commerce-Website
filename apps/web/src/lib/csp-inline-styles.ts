/**
 * Remaining React `style={{}}` usage that keeps `style-src-attr 'unsafe-inline'`.
 * Script/style *elements* still require a nonce. Attribute styles are the gap.
 */
export const CSP_STYLE_SRC_ATTR_UNSAFE_INLINE = "style-src-attr 'unsafe-inline'";

export const CSP_INLINE_STYLE_RESIDUALS = [
  "admin charts and redis graphs (AdminAnimatedCharts, AdminRedisGraph)",
  "email live preview and branding swatches",
  "appearance / theme color pickers",
  "rich-text editor color chips",
  "review and SEO score meters",
  "staggered animationDelay on admin settings and marketing pages",
  "opengraph-image.tsx and icon.tsx (ImageResponse, not browser CSP)",
  "global-error.tsx standalone styles",
] as const;
