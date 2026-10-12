import { hasCloudflareRay } from './cloudflare-edge';

describe('cloudflare edge signal', () => {
  it('does not treat a spoofed CF-Connecting-IP as proof of Cloudflare', () => {
    expect(
      hasCloudflareRay({
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '9.9.9.9',
      }),
    ).toBe(false);
  });

  it('accepts a Cloudflare Ray id', () => {
    expect(hasCloudflareRay({ 'cf-ray': '8a1b2c3d4e5f6a7b-DAC' })).toBe(true);
  });
});
