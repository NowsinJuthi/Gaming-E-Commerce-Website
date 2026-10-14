/** Registered web/admin/customer refresh sessions (≈10 years; renewed on each silent refresh). */
export const TEN_YEAR_SESSION_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

/** Default when JWT_REFRESH_TTL is unset. */
export const LONG_SESSION_TTL_SECONDS = TEN_YEAR_SESSION_TTL_SECONDS;

/** MFS phone app only. Stays signed in until the phone logs out. */
export const MFS_APP_SESSION_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

/** Ephemeral guest checkout/chat — short-lived, separate from registered users. */
export const GUEST_SESSION_TTL_SECONDS = 24 * 60 * 60;

export function parsePositiveSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
