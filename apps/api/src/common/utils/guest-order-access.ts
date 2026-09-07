import { createHmac, timingSafeEqual } from 'node:crypto';

/** Guest order receipt links remain valid for 180 days. */
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Opaque signed token for guest order receipt links (replaces email in URLs).
 * Format: base64url(orderId:orderNumber:issuedAt:signature)
 */
export function createGuestOrderAccessToken(
  orderId: string,
  orderNumber: string,
  secret: string,
  issuedAtMs = Date.now(),
): string {
  const id = orderId.trim();
  const num = orderNumber.trim();
  const payload = `${id}:${num}:${issuedAtMs}`;
  const sig = signPayload(payload, secret);
  return Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
}

export function verifyGuestOrderAccessToken(
  token: string,
  secret: string,
): { orderId: string; orderNumber: string } | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  try {
    const decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
    const lastSep = decoded.lastIndexOf(':');
    if (lastSep <= 0) return null;

    const sig = decoded.slice(lastSep + 1);
    const payload = decoded.slice(0, lastSep);
    const parts = payload.split(':');
    if (parts.length !== 3) return null;

    const [orderId, orderNumber, iatRaw] = parts;
    if (!orderId || !orderNumber) return null;

    const issuedAt = Number(iatRaw);
    if (!Number.isFinite(issuedAt)) return null;
    if (Date.now() - issuedAt > MAX_AGE_MS) return null;

    const expectedSig = signPayload(payload, secret);
    if (!safeEqual(sig, expectedSig)) return null;

    return { orderId, orderNumber };
  } catch {
    return null;
  }
}

/** Mask email for public receipt pages (e.g. sh***@gmail.com). */
export function maskCustomerEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0) return '***';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > 2 ? '***' : '**'}@${domain}`;
}
