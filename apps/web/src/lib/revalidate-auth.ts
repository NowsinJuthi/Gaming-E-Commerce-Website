import { hasStrictAdminRole } from "./auth-roles";

export type RevalidateAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function internalApiBase(): string {
  const raw =
    process.env.INTERNAL_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000/api";
  return raw.replace(/\/$/, "");
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function authorizeStorefrontRevalidate(
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<RevalidateAuthResult> {
  const token = extractBearerToken(request);
  const cookie = request.headers.get("cookie");
  if (!token && !cookie) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = cookie;
    const res = await fetchImpl(`${internalApiBase()}/auth/me`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 401, error: "Authentication required" };
    }
    if (!res.ok) {
      return { ok: false, status: 503, error: "Auth service unavailable" };
    }
    const user = (await res.json()) as { roles?: string[] };
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!hasStrictAdminRole(roles)) {
      return { ok: false, status: 403, error: "Administrator role required" };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "Auth service unavailable" };
  }
}
