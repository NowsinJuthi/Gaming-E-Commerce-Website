import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
} from "@/lib/security-headers";

function createRequestNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Edge middleware.
 * Scaffold only — auth checks and role-based routing for the
 * (dashboard) and (admin) route groups will be implemented here.
 */
export function middleware(request: NextRequest) {
  const nonce = createRequestNonce();
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (process.env.NODE_ENV === "production") {
    const host = request.nextUrl.hostname;
    const isLoopback = host === "127.0.0.1" || host === "localhost";
    const forwardedProto = request.headers.get("x-forwarded-proto");
    // Public traffic: nginx sets x-forwarded-proto. Skip native systemd health checks.
    if (!isLoopback && forwardedProto === "http") {
      const httpsUrl = request.nextUrl.clone();
      httpsUrl.protocol = "https:";
      const redirect = NextResponse.redirect(httpsUrl, 301);
      applySecurityHeaders(redirect, {
        includeHsts: false,
        nonce,
        includeCsp: true,
      });
      return redirect;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  // HSTS is owned by aaPanel nginx (see deploy/deploy/aapanel/nginx/*.conf).
  applySecurityHeaders(response, {
    includeHsts: false,
    nonce,
    includeCsp: true,
  });

  const path = request.nextUrl.pathname;
  const isAppHtml = !path.startsWith("/_next") && !path.includes(".");

  if (process.env.NODE_ENV === "development") {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
  } else if (isAppHtml) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/image|favicon.ico|favicon|admin/favicon|socket\\.io|.*\\..*).*)",
  ],
};
