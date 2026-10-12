const AUTH_CHANNEL = "uniqbd-auth";
const SESSION_CSRF_KEY = "authSession";
const SESSION_META_KEY = "authMeta";

export type BrowserAuthMeta = {
  roles: string[];
  isGuest: boolean;
  accessExpiresAt: number;
};

let authChannel: BroadcastChannel | null = null;

function channel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!authChannel) {
    authChannel = new BroadcastChannel(AUTH_CHANNEL);
    authChannel.addEventListener("message", (event: MessageEvent) => {
      const data = event.data as { type?: string };
      if (data?.type === "session") {
        window.dispatchEvent(new Event("auth-change"));
      }
    });
  }
  return authChannel;
}

function migrateLegacyAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

/** True when a browser CSRF session exists. The access JWT is HttpOnly. */
export function hasAuthSession(): boolean {
  if (typeof window === "undefined") return false;
  migrateLegacyAccessToken();
  channel();
  return Boolean(localStorage.getItem(SESSION_CSRF_KEY));
}

export function getSessionRoles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrowserAuthMeta;
    return Array.isArray(parsed.roles) ? parsed.roles : [];
  } catch {
    return [];
  }
}

export function getSessionMeta(): BrowserAuthMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowserAuthMeta;
    return parsed;
  } catch {
    return null;
  }
}

export function isGuestAuthSession(): boolean {
  return getSessionMeta()?.isGuest === true;
}

export function getAccessExpiresAt(): number | null {
  const exp = getSessionMeta()?.accessExpiresAt;
  return typeof exp === "number" ? exp : null;
}

/**
 * Access JWTs are stored in an HttpOnly cookie and are not readable by JS.
 * Callers that previously used this as a login check should use hasAuthSession().
 */
export function getAccessToken(): string | null {
  return null;
}

export function setAccessToken(_token: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
}

export function persistBrowserSession(meta: {
  csrfToken: string;
  roles?: string[];
  isGuest?: boolean;
  expiresIn?: number;
}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_CSRF_KEY, meta.csrfToken);
  localStorage.setItem(
    SESSION_META_KEY,
    JSON.stringify({
      roles: meta.roles ?? [],
      isGuest: meta.isGuest === true,
      accessExpiresAt: Date.now() + (meta.expiresIn ?? 900) * 1000,
    } satisfies BrowserAuthMeta),
  );
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  channel()?.postMessage({ type: "session" });
}

export function clearBrowserSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_CSRF_KEY);
  localStorage.removeItem(SESSION_META_KEY);
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  channel()?.postMessage({ type: "session" });
}

/** XSS regression probe: nothing on window may return an access JWT. */
export function xssWindowAccessTokenProbe(): unknown {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __UNIQBD_GET_ACCESS_TOKEN?: unknown })
    .__UNIQBD_GET_ACCESS_TOKEN;
}
