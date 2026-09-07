const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function parseOrigin(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Cross-origin origins worth preconnecting in the document head. */
export function getPreconnectOrigins(pageOrigin?: string): string[] {
  const page = parseOrigin(pageOrigin);
  const origins = new Set<string>();

  const apiOrigin = parseOrigin(API_BASE);
  if (apiOrigin) origins.add(apiOrigin);

  const filtered = [...origins].filter((origin) => {
    if (page && origin === page) return false;
    if (
      process.env.NODE_ENV === "production" &&
      isLoopbackOrigin(origin)
    ) {
      return false;
    }
    return true;
  });

  return filtered;
}
