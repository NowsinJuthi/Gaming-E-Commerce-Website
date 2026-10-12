import { getLicenseVendorConfig, isLicenseVendorReady } from './license.vendor-config';

describe('license vendor config', () => {
  const previous = process.env.LICENSE_SITE_SECRET;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.LICENSE_SITE_SECRET;
    } else {
      process.env.LICENSE_SITE_SECRET = previous;
    }
  });

  it('loads the site secret only from the environment', () => {
    delete process.env.LICENSE_SITE_SECRET;
    expect(getLicenseVendorConfig().siteSecret).toBe('');
    expect(isLicenseVendorReady()).toBe(false);
  });
});
