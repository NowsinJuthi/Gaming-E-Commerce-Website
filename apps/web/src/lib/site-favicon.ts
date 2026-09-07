import {
  cacheBust,
  sameOriginAssetPath,
  syncDocumentFavicon,
} from "@/lib/favicon-utils";
import { resolveLogoSrc } from "@/lib/site-appearance";

export const SITE_FAVICON_PATH = "/favicon";

/** Browser-facing storefront favicon — stable same-origin proxy route. */
export function publicSiteFaviconHref(cacheKey?: string): string {
  if (cacheKey?.trim()) {
    return cacheBust(SITE_FAVICON_PATH, cacheKey.trim());
  }
  return SITE_FAVICON_PATH;
}

/** Direct asset href when a uploaded logo is already on this origin. */
export function directSiteFaviconHref(raw?: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const resolved = resolveLogoSrc(trimmed);
  const localPath = sameOriginAssetPath(resolved);
  if (localPath) return cacheBust(localPath, trimmed);
  return null;
}

export function syncSiteDocumentFavicon(cacheKey?: string): void {
  syncDocumentFavicon({
    href: publicSiteFaviconHref(cacheKey),
    type: "image/png",
    linkIdPrefix: "site-favicon",
  });
}
