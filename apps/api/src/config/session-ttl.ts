/** Registered admin/customer sessions — bounded even when explicit logout is missed. */
export const LONG_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

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
