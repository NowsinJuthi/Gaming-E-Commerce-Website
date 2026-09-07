import { registerAs } from '@nestjs/config';

/**
 * Per-supplier credentials. Adapters read `suppliers.<code>`. When `baseUrl`
 * and a credential are absent the adapter runs in sandbox mode (generates
 * synthetic codes) so fulfillment and failover are exercisable in dev.
 */
export interface SupplierConfig {
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
}

export const suppliersConfig = registerAs('suppliers', () => ({
  reloadly: {
    baseUrl: process.env.RELOADLY_BASE_URL,
    apiKey: process.env.RELOADLY_API_KEY,
    clientId: process.env.RELOADLY_CLIENT_ID,
    clientSecret: process.env.RELOADLY_CLIENT_SECRET,
  } satisfies SupplierConfig,

  xsolla: {
    baseUrl: process.env.XSOLLA_BASE_URL,
    apiKey: process.env.XSOLLA_API_KEY,
    apiSecret: process.env.XSOLLA_MERCHANT_ID,
  } satisfies SupplierConfig,

  turgame: {
    baseUrl: process.env.TURGAME_BASE_URL,
    apiKey: process.env.TURGAME_API_KEY,
    apiSecret: process.env.TURGAME_API_SECRET,
  } satisfies SupplierConfig,

  foxreload: {
    baseUrl: process.env.FOXRELOAD_BASE_URL,
    apiKey: process.env.FOXRELOAD_API_KEY,
    apiSecret: process.env.FOXRELOAD_API_SECRET,
  } satisfies SupplierConfig,
}));
