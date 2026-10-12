import { registerAs } from '@nestjs/config';

import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';

/** Comma-separated origins in production, e.g. https://uniqbd.com,https://www.uniqbd.com */
export function parseCorsOrigins(
  raw: string | undefined,
): string | string[] {
  const value = raw ?? 'http://localhost:3000';
  if (!value.includes(',')) {
    return value;
  }
  const origins = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV,
  host:
    process.env.API_HOST ??
    (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
  corsOrigin: parseCorsOrigins(process.env.API_CORS_ORIGIN),
  publicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',
  uploadsDir: resolveUploadsRoot(),
}));
