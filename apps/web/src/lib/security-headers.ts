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

export function buildContentSecurityPolicy(nonce?: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const apiOrigins = readOriginsFromEnv([
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_WS_URL",
    "INTERNAL_API_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_LARGE_UPLOAD_ORIGIN",
  ]);

  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : isDev ? ["'unsafe-inline'"] : []),
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://www.google.com",
    "https://recaptcha.google.com",
    "https://www.gstatic.com",
    "https://www.recaptcha.net",
    "https://connect.facebook.net",
  ];

  const connectSrc = [
    "'self'",
    ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://www.google.com",
    "https://recaptcha.google.com",
    "https://www.gstatic.com",
    "https://www.recaptcha.net",
    "https://connect.facebook.net",
    "https://www.facebook.com",
    ...apiOrigins,
    ...apiOrigins.map((origin) => origin.replace(/^http/, "ws")),
  ];

  const styleSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : isDev ? ["'unsafe-inline'"] : []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    // Residual: React `style={{}}` attributes (charts, meters, email preview,
    // OG images, animation delays). Removing this directive breaks those UIs.
    "style-src-attr 'unsafe-inline'",
    [
      "img-src 'self' data: blob: https://image.tmdb.org",
      ...apiOrigins,
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://www.google.com",
      "https://www.gstatic.com",
    ].join(" "),
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    [
      "frame-src 'self'",
      "https://www.googletagmanager.com",
      "https://www.google.com",
      "https://recaptcha.google.com",
      "https://www.gstatic.com",
      "https://www.recaptcha.net",
    ].join(" "),
    `media-src 'self' blob: data: ${apiOrigins.join(" ")}`.trim(),
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
  nonce?: string;
  includeCsp?: boolean;
}): { key: string; value: string }[] {
  const isProd = process.env.NODE_ENV === "production";
  const includeHsts = isProd && options?.includeHsts !== false;
  const includeCsp = options?.includeCsp !== false;

  const headers: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  if (includeCsp) {
    headers.unshift({
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options?.nonce),
    });
  }

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
  options?: { includeHsts?: boolean; nonce?: string; includeCsp?: boolean },
): void {
  for (const { key, value } of getSecurityHeaders(options)) {
    response.headers.set(key, value);
  }
}
