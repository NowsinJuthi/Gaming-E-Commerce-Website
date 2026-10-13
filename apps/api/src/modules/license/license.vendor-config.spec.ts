import { getLicenseVendorConfig, isLicenseVendorReady } from './license.vendor-config';

describe('license vendor config', () => {
  const previousSecret = process.env.LICENSE_SITE_SECRET;
  const previousApi = process.env.LICENSE_API_URL;

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.LICENSE_SITE_SECRET;
    else process.env.LICENSE_SITE_SECRET = previousSecret;
    if (previousApi === undefined) delete process.env.LICENSE_API_URL;
    else process.env.LICENSE_API_URL = previousApi;
  });

  it('opens the sealed API address and website secret from code', () => {
    delete process.env.LICENSE_SITE_SECRET;
    delete process.env.LICENSE_API_URL;
    const config = getLicenseVendorConfig();
    expect(config.apiUrl).toBe('https://license.amarpin.com/api');
    expect(config.productId).toBe('');
    expect(config.websiteId).toBe('');
    expect(config.siteSecret.length).toBeGreaterThan(20);
    expect(isLicenseVendorReady(config)).toBe(true);
  });
});
