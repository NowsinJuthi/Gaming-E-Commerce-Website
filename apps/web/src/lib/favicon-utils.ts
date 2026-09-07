import { resolveLogoSrc } from "@/lib/site-appearance";

export function guessFaviconMime(url: string): string {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ico":
      return "image/x-icon";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "image/png";
  }
}

export function cacheBust(url: string, key: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(key)}`;
}

/** Same-origin path for uploads and public/ assets (no cross-origin hop). */
export function sameOriginAssetPath(resolved: string): string | null {
  if (!resolved) return null;

  if (
    resolved.startsWith("/logo/") ||
    resolved.startsWith("/payments/") ||
    resolved.startsWith("/api/uploads/")
  ) {
    return resolved;
  }

  if (/^https?:\/\//i.test(resolved)) {
    try {
      const parsed = new URL(resolved);
      if (
        parsed.pathname.startsWith("/api/uploads/") ||
        parsed.pathname.startsWith("/logo/") ||
        parsed.pathname.startsWith("/payments/")
      ) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function serverAssetUrl(pathname: string, requestOrigin: string): string {
  // Uploaded assets are proxied by the web app (/api/uploads → API). Fetching
  // through requestOrigin works in dev (remote API) and prod without requiring
  // INTERNAL_API_URL to reach the API from the Next.js server.
  if (pathname.startsWith("/api/")) {
    return `${requestOrigin}${pathname}`;
  }
  return `${requestOrigin}${pathname}`;
}

/** Server-side URL to fetch favicon bytes (loopback for API uploads). */
export function resolveFaviconFetchUrl(
  raw: string,
  requestOrigin: string,
  fallbackPath = "/icon",
): string {
  const resolved = resolveLogoSrc(raw);
  const localPath = sameOriginAssetPath(resolved);

  if (localPath) {
    if (localPath.startsWith("/api/")) {
      return serverAssetUrl(localPath, requestOrigin);
    }
    return `${requestOrigin}${localPath}`;
  }

  if (/^https?:\/\//i.test(resolved)) return resolved;

  if (resolved.startsWith("/")) return `${requestOrigin}${resolved}`;

  return `${requestOrigin}${fallbackPath}`;
}

/**
 * Keep all favicon link tags in sync without removing SSR-injected nodes
 * (removing them corrupts React's fiber tree).
 */
export function syncDocumentFavicon(options: {
  href: string;
  type?: string;
  linkIdPrefix: string;
}): void {
  if (typeof document === "undefined") return;

  const { href, type = "image/png", linkIdPrefix } = options;

  document.head
    .querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    )
    .forEach((el) => {
      el.type = type;
      el.href = href;
    });

  for (const rel of ["icon", "shortcut icon"] as const) {
    const id = rel === "icon" ? linkIdPrefix : `${linkIdPrefix}-shortcut`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = type;
    link.href = href;
  }
}

export function buildFaviconResponse(
  body: ArrayBuffer,
  contentType: string,
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
