function readOriginsFromEnv(keys: string[]): string[] {
  const origins = new Set<string>();

  for (const key of keys) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;

    try {
      origins.add(new URL(raw.replace(/\/$/, "")).origin);
    } catch {
      /* ignore invalid URLs */
    }
  }

  return [...origins];
}

/** Mozilla-recognizable HSTS — set on nginx HTTPS vhosts only (not Next.js). */
export const HSTS_HEADER_VALUE =
  "max-age=63072000; includeSubDomains; preload";

function buildContentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === "development";
  const apiOrigins = readOriginsFromEnv([
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_WS_URL",
    "INTERNAL_API_URL",
    "NEXT_PUBLIC_SITE_URL",
  ]);

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://connect.facebook.net",
  ];

  const connectSrc = [
    "'self'",
    "wss:",
    ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    "https://www.facebook.com",
    ...apiOrigins,
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://www.googletagmanager.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function getSecurityHeaders(options?: {
  includeHsts?: boolean;
}): { key: string; value: string }[] {
  const isProd = process.env.NODE_ENV === "production";
  const includeHsts = isProd && options?.includeHsts !== false;

  const headers: { key: string; value: string }[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  if (includeHsts) {
    headers.push({
      key: "Strict-Transport-Security",
      value: HSTS_HEADER_VALUE,
    });
  }

  return headers;
}

/** Attach security headers to a Next.js middleware / route response. */
export function applySecurityHeaders(
  response: Response,
  options?: { includeHsts?: boolean },
): void {
  for (const { key, value } of getSecurityHeaders(options)) {
    response.headers.set(key, value);
  }
}
