import type { PaymentMethod } from '../enums';

export type OrderClientMeta = {
  customerIp?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  operatingSystem?: string;
};

export function paymentMethodToOriginChannel(
  method?: PaymentMethod | string,
): string {
  if (method === 'manual') return 'Manual checkout';
  if (method === 'gateway') return 'Gateway';
  return 'Direct';
}

/** Lightweight UA parsing — no extra dependency. */
export function parseClientUserAgent(userAgent?: string): Pick<
  OrderClientMeta,
  'device' | 'browser' | 'operatingSystem'
> {
  if (!userAgent?.trim()) {
    return {};
  }

  const ua = userAgent.toLowerCase();

  let device = 'Desktop';
  if (/ipad|tablet|kindle/.test(ua)) {
    device = 'Tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua)) {
    device = 'Mobile';
  }

  let browser = 'Unknown';
  if (ua.includes('edg/')) {
    browser = 'Edge';
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome/') || ua.includes('crios/')) {
    browser = 'Chrome';
  } else if (ua.includes('safari/')) {
    browser = 'Safari';
  }

  let operatingSystem = 'Unknown';
  if (ua.includes('windows')) {
    operatingSystem = 'Windows';
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    operatingSystem = 'macOS';
  } else if (ua.includes('android')) {
    operatingSystem = 'Android';
  } else if (/iphone|ipad|ipod/.test(ua)) {
    operatingSystem = 'iOS';
  } else if (ua.includes('linux')) {
    operatingSystem = 'Linux';
  }

  return { device, browser, operatingSystem };
}

export function buildOrderOrigin(
  meta: OrderClientMeta | undefined,
  paymentMethod?: PaymentMethod | string,
): OrderClientMeta & { channel: string } {
  const parsed = parseClientUserAgent(meta?.userAgent);
  return {
    channel: paymentMethodToOriginChannel(paymentMethod),
    customerIp: meta?.customerIp,
    userAgent: meta?.userAgent,
    device: meta?.device ?? parsed.device,
    browser: meta?.browser ?? parsed.browser,
    operatingSystem: meta?.operatingSystem ?? parsed.operatingSystem,
  };
}
