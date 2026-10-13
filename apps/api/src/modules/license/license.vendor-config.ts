import { createDecipheriv, createHash } from 'node:crypto';

/**
 * Server-only vendor credentials. The API address and website secret are
 * stored sealed in this file. Activation uses the admin license key plus
 * these two values. Product id is not part of the check.
 */
export type LicenseVendorConfig = {
  apiUrl: string;
  productId: string;
  websiteId: string;
  siteSecret: string;
};

const SEALED_API_URL =
  'gm1JVxVoKa3sVKCE1BTGNwz2uLtt1tk8cRGISMGwSag3JuxDI4FTaXU2LvdN67T15XBERgSqTfJ0k1M=';
const SEALED_SITE_SECRET =
  'W8sqJcG5YxZfEmCXF6Bgr3sBUX/FIfaf4kblielpkwK630/bvkoeTGZBONw6ZDA7gGG7A+8Ze01MvvpJ4C4SJ2Yl77nwI32b';

export function getLicenseVendorConfig(): LicenseVendorConfig {
  return {
    apiUrl: openSeal(SEALED_API_URL) || 'https://license.amarpin.com/api',
    productId: '',
    websiteId: '',
    siteSecret: openSeal(SEALED_SITE_SECRET),
  };
}

export function isLicenseVendorReady(
  config: LicenseVendorConfig = getLicenseVendorConfig(),
): boolean {
  return Boolean(config.apiUrl?.trim() && config.siteSecret?.trim());
}

function openSeal(packed: string): string {
  try {
    const key = createHash('sha256').update('uniqbd-license-vendor-v1').digest();
    const bytes = Buffer.from(packed, 'base64');
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const ciphertext = bytes.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
      .toString('utf8')
      .trim();
  } catch {
    return '';
  }
}
