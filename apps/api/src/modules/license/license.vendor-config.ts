/**
 * Optional env fallback for license vendor settings. Production should store
 * apiUrl, productId, websiteId, and siteSecret in MongoDB (license_settings)
 * via Admin → License; leave LICENSE_* unset in api.env.
 */
export type LicenseVendorConfig = {
  apiUrl: string;
  productId: string;
  websiteId: string;
  siteSecret: string;
};

export function getLicenseVendorConfig(): LicenseVendorConfig {
  return {
    apiUrl:
      process.env.LICENSE_API_URL?.trim() || 'https://license.amarpin.com/api',
    productId: process.env.LICENSE_PRODUCT_ID?.trim() || 'amarpin-pro',
    websiteId: process.env.LICENSE_WEBSITE_ID?.trim() || '',
    siteSecret: process.env.LICENSE_SITE_SECRET?.trim() || '',
  };
}

export function isLicenseVendorReady(
  config: LicenseVendorConfig = getLicenseVendorConfig(),
): boolean {
  return Boolean(config.siteSecret?.trim());
}
