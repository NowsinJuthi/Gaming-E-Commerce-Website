/**
 * Copy to `license.vendor-config.ts` before deploy.
 * Site secret and website ID ship with the application — not MongoDB or .env.
 * End admins only enter a license key in the admin panel.
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
