import type { Request } from 'express';

/** Request fields populated by RealIpMiddleware from Cloudflare/proxy headers. */
export interface SecurityContext {
  realIp?: string;
  cfCountry?: string;
  cfRay?: string;
}

export type RequestWithContext = Request & SecurityContext;

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Resolves the best client IP, preferring Cloudflare-provided headers. */
export function resolveClientIp(req: Request): string | undefined {
  const ctx = req as RequestWithContext;
  if (ctx.realIp) {
    return ctx.realIp;
  }
  const cf = headerValue(req.headers['cf-connecting-ip']);
  if (cf) return cf;
  const trueClient = headerValue(req.headers['true-client-ip']);
  if (trueClient) return trueClient;
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return req.ip;
}
