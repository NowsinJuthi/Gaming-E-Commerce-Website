import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large Samba uploads (network + disk copy). */
export const maxDuration = 3600;

function internalApiBase(): string {
  const raw = (process.env.INTERNAL_API_URL || "http://127.0.0.1:4000/api").trim();
  const normalized = raw.replace(/\/$/, "");
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(normalized)) {
    return normalized.replace(/\/api\/?$/, "") + "/api";
  }
  return "http://127.0.0.1:4000/api";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Streams multipart uploads to Nest without Next rewrite body limits.
 * Same pattern as Movie-Server /api/smb-upload — use from admin with credentials.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return jsonError("Server id is required.", 400);
    }

    const body = req.body;
    if (!body) {
      return jsonError("Empty upload body.", 400);
    }

    const target = `${internalApiBase()}/admin/media-shares/${encodeURIComponent(id)}/upload`;

    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    const contentLength = req.headers.get("content-length");
    const cookie = req.headers.get("cookie");
    const authorization = req.headers.get("authorization");
    const csrf = req.headers.get("x-csrf-token");
    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (cookie) headers.set("cookie", cookie);
    if (authorization) headers.set("authorization", authorization);
    if (csrf) headers.set("x-csrf-token", csrf);

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const out = new Headers();
    for (const key of ["content-type"]) {
      const value = upstream.headers.get(key);
      if (value) out.set(key, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Upload proxy failed.";
    return jsonError(
      `Upload proxy failed (${detail}). Check INTERNAL_API_URL and uniqbd-api on port 4000.`,
      502,
    );
  }
}
