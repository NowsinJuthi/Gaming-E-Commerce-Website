import { registerAs } from '@nestjs/config';
import {
  GUEST_SESSION_TTL_SECONDS,
  LONG_SESSION_TTL_SECONDS,
  TEN_YEAR_SESSION_TTL_SECONDS,
  parsePositiveSeconds,
} from '../session-ttl';

/** 15-minute access tokens logged people out whenever cookie refresh failed. */
function resolveRegisteredAccessTtl(raw: string | undefined): number {
  const parsed = parsePositiveSeconds(raw, TEN_YEAR_SESSION_TTL_SECONDS);
  if (parsed <= 900) return TEN_YEAR_SESSION_TTL_SECONDS;
  return Math.min(parsed, TEN_YEAR_SESSION_TTL_SECONDS);
}

function requireSecret(envVar: string, devFallback: string): string {
  const value = process.env[envVar];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Missing required environment variable: ${envVar}. Set this before starting in production.`,
      );
    }
    return devFallback;
  }
  return value;
}

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: requireSecret('JWT_ACCESS_SECRET', 'change-me-access'),
  /**
   * Registered web/admin/customer access JWT (`/auth/login`).
   * Kept for 10 years so a missed silent refresh does not sign the user out.
   * The MFS SMS app passes its own TTL and is not affected.
   * A stale JWT_ACCESS_TTL of 900 (the old 15-minute default) is ignored.
   */
  accessTtl: resolveRegisteredAccessTtl(process.env.JWT_ACCESS_TTL),
  refreshSecret: requireSecret('JWT_REFRESH_SECRET', 'change-me-refresh'),
  /**
   * Registered web/admin/customer refresh sessions (`/auth/login`, `/auth/refresh`).
   * Independent of `payments.mfsApp*` used by the Android SMS forwarder.
   */
  refreshTtl: parsePositiveSeconds(
    process.env.JWT_REFRESH_TTL,
    LONG_SESSION_TTL_SECONDS,
  ),
  /** Guest checkout/chat only — does not apply to registered accounts. */
  guestRefreshTtl: parsePositiveSeconds(
    process.env.JWT_GUEST_REFRESH_TTL,
    GUEST_SESSION_TTL_SECONDS,
  ),
}));
