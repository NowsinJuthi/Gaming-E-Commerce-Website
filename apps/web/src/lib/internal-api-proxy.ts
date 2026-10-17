import { NextRequest, NextResponse } from "next/server";

/** Loopback Nest base for server-side proxy (same host as systemd uniqbd-api). */
export function internalApiBase(): string {
  const raw = (process.env.INTERNAL_API_URL || "http://127.0.0.1:4000/api").trim();
  const normalized = raw.replace(/\/$/, "");
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(normalized)) {
    return normalized.replace(/\/api\/?$/, "") + "/api";
  }
  return "http://127.0.0.1:4000/api";
}

const FORWARD_REQUEST_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "x-csrf-token",
  "x-api-key",
] as const;

const FORWARD_RESPONSE_HEADERS = ["content-type", "set-cookie"] as const;

export function jsonProxyError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function proxyToNest(
  req: NextRequest,
  nestPath: string,
  method: string,
): Promise<NextResponse> {
  const path = nestPath.startsWith("/") ? nestPath : `/${nestPath}`;
  const url = new URL(req.url);
  const target = `${internalApiBase()}${path}${url.search}`;

  const headers = new Headers();
  for (const key of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  const init: RequestInit = { method, headers, cache: "no-store" };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Upstream unreachable";
    return jsonProxyError(
      `API proxy failed (${detail}). Is uniqbd-api running on port 4000?`,
      502,
    );
  }

  const out = new Headers();
  for (const key of FORWARD_RESPONSE_HEADERS) {
    const values =
      key === "set-cookie"
        ? (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
          (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")!] : [])
        : [upstream.headers.get(key)].filter(Boolean);
    for (const value of values) {
      if (value) out.append(key, value);
    }
  }

  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: out,
  });
}
