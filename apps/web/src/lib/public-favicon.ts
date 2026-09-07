import { guessFaviconMime } from "@/lib/favicon-utils";
import { normalizeSiteAppearance } from "@/lib/site-appearance";

export function pickFaviconSource(
  appearance: ReturnType<typeof normalizeSiteAppearance>,
): string {
  const admin = appearance.adminFaviconUrl.trim();
  if (admin) return admin;
  return appearance.logoUrlLight.trim() || appearance.logoUrlDark.trim();
}

/** MIME for <link rel="icon"> — SVG sources are served as PNG from the proxy route. */
export function publicFaviconLinkMime(raw: string): string {
  if (!raw.trim()) return "image/png";
  const mime = guessFaviconMime(raw);
  return mime === "image/svg+xml" ? "image/png" : mime;
}
