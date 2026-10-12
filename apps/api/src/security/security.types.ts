import type { Request } from 'express';

/** Request fields populated by RealIpMiddleware from Cloudflare/proxy headers. */
export interface SecurityContext {
  realIp?: string;
  cfCountry?: string;
  cfRay?: string;
}

export type RequestWithContext = Request & SecurityContext;

/**
 * Client IP for throttling and audit.
 *
 * Uses Express `req.ip` (honours `trust proxy`) instead of raw
 * `CF-Connecting-IP` / `X-Forwarded-For` headers. Those headers are
 * attacker-controlled unless nginx overwrites them from `$remote_addr`.
 */
export function resolveClientIp(req: Request): string | undefined {
  const ctx = req as RequestWithContext;
  if (ctx.realIp) {
    return ctx.realIp;
  }
  return req.ip;
}
