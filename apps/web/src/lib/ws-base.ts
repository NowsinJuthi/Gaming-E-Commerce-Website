const FALLBACK_WS_BASE = (
  process.env.NEXT_PUBLIC_WS_URL ??
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(
    /\/api\/?$/,
    "",
  )
).replace(/\/$/, "");

function readConfiguredWsBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function isLocalhostHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Browser Socket.IO base URL.
 * Prefer NEXT_PUBLIC_WS_URL (e.g. https://api.uniqbd.com) so chat connects
 * directly to the API host. Falling back to the storefront origin only when
 * unset (local Next.js `/socket.io/` rewrite).
 */
export function getWsBase(): string {
  const configured = readConfiguredWsBase();

  if (typeof window !== "undefined") {
    if (configured) {
      try {
        const wsHost = new URL(configured).hostname;
        const pageHost = window.location.hostname;
        // Dev: page opened via LAN IP but WS URL still points at localhost.
        if (isLocalhostHost(wsHost) && !isLocalhostHost(pageHost)) {
          return window.location.origin;
        }
      } catch {
        /* use configured */
      }
      return configured;
    }
    return window.location.origin;
  }

  return configured ?? FALLBACK_WS_BASE;
}
