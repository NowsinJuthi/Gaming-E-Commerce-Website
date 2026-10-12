import type { Request } from 'express';
import { resolveClientIp } from './security.types';

describe('resolveClientIp', () => {
  it('ignores spoofed Cloudflare and forwarded headers', () => {
    const req = {
      ip: '203.0.113.10',
      headers: {
        'cf-connecting-ip': '1.2.3.4',
        'true-client-ip': '1.2.3.4',
        'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      },
    } as unknown as Request;

    expect(resolveClientIp(req)).toBe('203.0.113.10');
  });

  it('uses middleware-assigned realIp when present', () => {
    const req = {
      ip: '127.0.0.1',
      realIp: '198.51.100.9',
      headers: {},
    } as unknown as Request;

    expect(resolveClientIp(req)).toBe('198.51.100.9');
  });
});
