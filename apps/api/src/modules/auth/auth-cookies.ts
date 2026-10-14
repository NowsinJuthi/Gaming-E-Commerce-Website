export const ACCESS_COOKIE_NAME = 'uniqbd_access';
export const REFRESH_COOKIE_NAME = 'uniqbd_refresh';

export type AuthCookieFlags = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  domain?: string;
};

/** Browser logins send Origin (or an existing auth cookie). API clients do not. */
export function isBrowserAuthRequest(input: {
  origin?: string | string[];
  cookie?: string;
}): boolean {
  const origin = Array.isArray(input.origin) ? input.origin[0] : input.origin;
  if (typeof origin === 'string' && origin.trim()) return true;
  const cookie = input.cookie ?? '';
  return (
    cookie.includes(`${ACCESS_COOKIE_NAME}=`) ||
    cookie.includes(`${REFRESH_COOKIE_NAME}=`)
  );
}

export function extractAccessTokenFromHandshake(input: {
  authToken?: string;
  authorization?: string;
  cookie?: string;
}): string | undefined {
  if (input.authToken) return input.authToken;
  if (input.authorization) {
    return input.authorization.replace(/^Bearer\s+/i, '').trim() || undefined;
  }
  return readNamedCookie(input.cookie, ACCESS_COOKIE_NAME);
}

export function readNamedCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function accessCookieOptions(input: {
  production: boolean;
  maxAgeSeconds: number;
  domain?: string | null;
}): AuthCookieFlags {
  const domain = input.domain?.trim();
  return {
    httpOnly: true,
    secure: input.production,
    sameSite: 'lax',
    path: '/',
    maxAge: input.maxAgeSeconds * 1000,
    ...(domain ? { domain } : {}),
  };
}

export function refreshCookieOptions(input: {
  production: boolean;
  path: string;
  maxAgeSeconds: number;
  domain?: string | null;
}): AuthCookieFlags {
  const domain = input.domain?.trim();
  return {
    httpOnly: true,
    secure: input.production,
    sameSite: 'lax',
    path: input.path,
    maxAge: input.maxAgeSeconds * 1000,
    ...(domain ? { domain } : {}),
  };
}

/** Browser JSON must never include stealable tokens. */
export function omitSecretsFromBrowserSession<T extends Record<string, unknown>>(
  result: T,
): Omit<T, 'accessToken' | 'refreshToken'> & { csrfToken: string } {
  const { accessToken: _a, refreshToken: _r, ...rest } = result;
  return rest as Omit<T, 'accessToken' | 'refreshToken'> & { csrfToken: string };
}

/**
 * Simulated same-origin XSS: script can read JS memory, localStorage, and
 * non-HttpOnly document.cookie. HttpOnly cookies are not present.
 */
export function xssReadableSecrets(input: {
  documentCookie: string;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  windowGlobals: Record<string, unknown>;
}): string[] {
  const found: string[] = [];
  const jwtLike = (value: string) =>
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
  const inspect = (raw: string) => {
    if (jwtLike(raw) || raw.startsWith('eyJ')) found.push(raw);
  };
  for (const part of input.documentCookie.split(';')) {
    inspect(part.trim().split('=').slice(1).join('='));
  }
  for (const value of Object.values(input.localStorage)) inspect(value);
  for (const value of Object.values(input.sessionStorage)) inspect(value);
  for (const value of Object.values(input.windowGlobals)) {
    if (typeof value === 'string') inspect(value);
    if (typeof value === 'function') {
      try {
        const result = value();
        if (typeof result === 'string') inspect(result);
      } catch {
        /* ignore */
      }
    }
  }
  return found;
}
