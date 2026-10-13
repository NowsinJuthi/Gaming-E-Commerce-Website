import { registerAs } from '@nestjs/config';
import {
  MFS_APP_SESSION_TTL_SECONDS,
  parsePositiveSeconds,
} from '../session-ttl';

/**
 * Per-gateway credentials. Each adapter reads `payments.<gateway>`.
 * When `baseUrl`/`apiKey` are absent the adapter falls back to a sandbox
 * flow so the system runs end-to-end in development without live secrets.
 */
export interface GatewayConfig {
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  username?: string;
  password?: string;
}

export const paymentsConfig = registerAs('payments', () => ({
  // Public URL of the API (used to build gateway callback/webhook URLs).
  callbackBaseUrl:
    process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api',
  // Public URL of the storefront (used for shopper redirect after payment).
  appUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
  mfsSmsSyncToken: process.env.MFS_SMS_SYNC_TOKEN,
  /**
   * Paymently / legacy SMS Android app only — NOT used by web `/auth/login`.
   * Separate from JWT_ACCESS_TTL so changing web session length never affects
   * the mobile forwarder (and vice versa).
   */
  mfsAppAccessTtlSeconds: parsePositiveSeconds(
    process.env.MFS_APP_ACCESS_TTL_SECONDS,
    MFS_APP_SESSION_TTL_SECONDS,
  ),
  /** Refresh-session TTL for the same app; independent of JWT_REFRESH_TTL. */
  mfsAppRefreshTtlSeconds: parsePositiveSeconds(
    process.env.MFS_APP_REFRESH_TTL_SECONDS ??
      process.env.MFS_APP_ACCESS_TTL_SECONDS,
    MFS_APP_SESSION_TTL_SECONDS,
  ),

  bkash: {
    baseUrl: process.env.BKASH_BASE_URL,
    apiKey: process.env.BKASH_APP_KEY,
    apiSecret: process.env.BKASH_APP_SECRET,
    username: process.env.BKASH_USERNAME,
    password: process.env.BKASH_PASSWORD,
    webhookSecret: process.env.BKASH_WEBHOOK_SECRET,
  } satisfies GatewayConfig,

  nagad: {
    baseUrl: process.env.NAGAD_BASE_URL,
    apiKey: process.env.NAGAD_MERCHANT_ID,
    apiSecret: process.env.NAGAD_PRIVATE_KEY,
    webhookSecret: process.env.NAGAD_WEBHOOK_SECRET,
  } satisfies GatewayConfig,

  rocket: {
    baseUrl: process.env.ROCKET_BASE_URL,
    apiKey: process.env.ROCKET_API_KEY,
    apiSecret: process.env.ROCKET_API_SECRET,
    webhookSecret: process.env.ROCKET_WEBHOOK_SECRET,
  } satisfies GatewayConfig,

  upay: {
    baseUrl: process.env.UPAY_BASE_URL,
    apiKey: process.env.UPAY_API_KEY,
    apiSecret: process.env.UPAY_API_SECRET,
    webhookSecret: process.env.UPAY_WEBHOOK_SECRET,
  } satisfies GatewayConfig,

  uddoktapay: {
    baseUrl: process.env.UDDOKTAPAY_BASE_URL,
    apiKey: process.env.UDDOKTAPAY_API_KEY,
    webhookSecret: process.env.UDDOKTAPAY_WEBHOOK_SECRET,
  } satisfies GatewayConfig,
}));
