import {
  cacheBust,
  guessFaviconMime,
  resolveFaviconFetchUrl,
  syncDocumentFavicon,
} from "@/lib/favicon-utils";

export const ADMIN_FAVICON_PATH = "/admin/favicon";

export { guessFaviconMime };

/** Browser-facing admin favicon href — always the /admin/favicon proxy route. */
export function publicAdminFaviconHref(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return ADMIN_FAVICON_PATH;
  return cacheBust(ADMIN_FAVICON_PATH, trimmed);
}

/** @deprecated Use {@link publicAdminFaviconHref}. */
export function adminFaviconHref(cacheKey?: string): string {
  return publicAdminFaviconHref(cacheKey);
}

/** Server-side URL to fetch admin favicon bytes. */
export function resolveAdminFaviconFetchUrl(
  raw: string,
  requestOrigin: string,
): string {
  if (!raw.trim()) return `${requestOrigin}/icon`;
  return resolveFaviconFetchUrl(raw, requestOrigin);
}

export function syncAdminDocumentFavicon(adminFaviconUrl?: string): void {
  const trimmed = adminFaviconUrl?.trim() ?? "";
  const href = trimmed
    ? cacheBust(ADMIN_FAVICON_PATH, trimmed)
    : ADMIN_FAVICON_PATH;
  const type = trimmed
    ? guessFaviconMime(trimmed) === "image/svg+xml"
      ? "image/png"
      : guessFaviconMime(trimmed)
    : "image/png";

  syncDocumentFavicon({
    href,
    type,
    linkIdPrefix: "admin-dashboard-favicon",
  });
}
