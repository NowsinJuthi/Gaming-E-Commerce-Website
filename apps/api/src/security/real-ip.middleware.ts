import type { NextFunction, Response } from 'express';
import { RequestWithContext } from './security.types';

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Normalizes the real client IP and Cloudflare metadata onto the request so
 * downstream guards (throttling), audit, and activity tracking all key off the
 * true visitor rather than the edge proxy IP. Registered globally via
 * `app.use()` so it runs before guards/interceptors.
 */
export function realIpMiddleware(
  req: RequestWithContext,
  _res: Response,
  next: NextFunction,
): void {
  req.realIp = req.ip;
  req.cfCountry = headerValue(req.headers['cf-ipcountry']);
  req.cfRay = headerValue(req.headers['cf-ray']);
  next();
}
