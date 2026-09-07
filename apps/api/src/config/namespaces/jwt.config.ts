import { registerAs } from '@nestjs/config';
import {
  GUEST_SESSION_TTL_SECONDS,
  LONG_SESSION_TTL_SECONDS,
  parsePositiveSeconds,
} from '../session-ttl';

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
   * Short-lived access JWT for web/admin/customer (`/auth/login`).
   * Silently renewed via refresh token — does not affect the MFS SMS app.
   */
  accessTtl: parsePositiveSeconds(process.env.JWT_ACCESS_TTL, 900),
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
