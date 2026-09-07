import { registerAs } from '@nestjs/config';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = parseFloat(value ?? '');
  return Number.isNaN(parsed) ? fallback : parsed;
};

export interface RecaptchaConfig {
  secret?: string;
  /** v3 score threshold below which a request is rejected. */
  minScore: number;
  verifyUrl: string;
}

export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
  blockMs: number;
  authTtlMs: number;
  authLimit: number;
}

export interface CloudflareConfig {
  /** Number of proxy hops in front of the app (Cloudflare + LB, etc.). */
  trustProxyHops: number;
}

export interface ActivityConfig {
  enabled: boolean;
  retentionDays: number;
}

export const securityConfig = registerAs('security', () => ({
  recaptcha: {
    secret: process.env.RECAPTCHA_SECRET,
    minScore: toFloat(process.env.RECAPTCHA_MIN_SCORE, 0.5),
    verifyUrl:
      process.env.RECAPTCHA_VERIFY_URL ??
      'https://www.google.com/recaptcha/api/siteverify',
  } satisfies RecaptchaConfig,

  throttle: {
    ttlMs: toInt(process.env.THROTTLE_TTL_MS, 60_000),
    limit: toInt(process.env.THROTTLE_LIMIT, 500),
    blockMs: toInt(process.env.THROTTLE_BLOCK_MS, 60_000),
    authTtlMs: toInt(process.env.THROTTLE_AUTH_TTL_MS, 60_000),
    authLimit: toInt(process.env.THROTTLE_AUTH_LIMIT, 10),
  } satisfies ThrottleConfig,

  cloudflare: {
    trustProxyHops: toInt(process.env.TRUST_PROXY_HOPS, 1),
  } satisfies CloudflareConfig,

  activity: {
    enabled: (process.env.ACTIVITY_TRACKING ?? 'true') !== 'false',
    retentionDays: toInt(process.env.ACTIVITY_RETENTION_DAYS, 60),
  } satisfies ActivityConfig,
}));
