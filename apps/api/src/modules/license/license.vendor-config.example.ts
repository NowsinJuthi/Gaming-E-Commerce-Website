/**
 * Example only. Real vendor credentials belong in server environment variables:
 * LICENSE_SITE_SECRET, LICENSE_API_URL, LICENSE_PRODUCT_ID, LICENSE_WEBSITE_ID.
 * Never commit a live site secret. Rotate any secret that previously lived in
 * `license.vendor-config.ts`.
 */
export type LicenseVendorConfig = {
  apiUrl: string;
  productId: string;
  websiteId: string;
  siteSecret: string;
};

export const LICENSE_VENDOR_CONFIG: LicenseVendorConfig = {
  apiUrl: 'https://license.amarpin.com/api',
  productId: 'amarpin-pro',
  websiteId: '',
  siteSecret: '',
};

export function isLicenseVendorReady(
  config: LicenseVendorConfig = LICENSE_VENDOR_CONFIG,
): boolean {
  return Boolean(config.siteSecret?.trim());
}
