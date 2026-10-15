/** Registered web/admin/customer refresh sessions (≈10 years; renewed on each silent refresh). */
export const TEN_YEAR_SESSION_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

/** Default when JWT_REFRESH_TTL is unset. */
export const LONG_SESSION_TTL_SECONDS = TEN_YEAR_SESSION_TTL_SECONDS;

/** MFS phone app only. Stays signed in until the phone logs out. */
export const MFS_APP_SESSION_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

/** Ephemeral guest checkout/chat — short-lived, separate from registered users. */
export const GUEST_SESSION_TTL_SECONDS = 24 * 60 * 60;

/**
 * Chrome and Safari drop cookies whose expiry is more than 400 days ahead.
 * The server session is still 10 years; each silent refresh slides this window.
 */
export const BROWSER_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Registered web sessions ignore a short JWT_ACCESS_TTL (production still has
 * the old 15-minute value). Guests and the MFS app pass their own TTL.
 */
export function resolveRegisteredAccessTtl(configured: number | undefined): number {
  if (configured == null || configured < TEN_YEAR_SESSION_TTL_SECONDS) {
    return TEN_YEAR_SESSION_TTL_SECONDS;
  }
  return configured;
}

export function resolveRegisteredRefreshTtl(configured: number | undefined): number {
  if (configured == null || configured < TEN_YEAR_SESSION_TTL_SECONDS) {
    return TEN_YEAR_SESSION_TTL_SECONDS;
  }
  return configured;
}

export function browserCookieMaxAgeSeconds(ttlSeconds: number): number {
  return Math.min(Math.max(1, Math.floor(ttlSeconds)), BROWSER_COOKIE_MAX_AGE_SECONDS);
}

export function parsePositiveSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
