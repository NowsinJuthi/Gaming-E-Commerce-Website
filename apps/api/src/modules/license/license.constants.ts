/** Amarpin catalog keys plus UniQbd admin feature gates. */
export const LICENSE_FEATURE_KEYS = [
  'topup',
  'giftCard',
  'reseller',
  'autoDelivery',
  'paymentGateway',
  'api',
  'liveChat',
  'customOrder',
  'reports',
  'email',
] as const;

export type LicenseFeatureKey = (typeof LICENSE_FEATURE_KEYS)[number];

export const LICENSE_FEATURE_LABELS: Record<LicenseFeatureKey, string> = {
  topup: 'Game TopUp',
  giftCard: 'Gift Card',
  reseller: 'Reseller',
  autoDelivery: 'Auto Delivery',
  paymentGateway: 'Payment gateways',
  api: 'Store settings',
  liveChat: 'Live chat',
  customOrder: 'Custom order fields',
  reports: 'Reports',
  email: 'Email / SMTP',
};

/** Admin routes gated by license features (license page itself is always open). */
export const LICENSE_ADMIN_ROUTE_FEATURES: Partial<
  Record<string, LicenseFeatureKey>
> = {
  '/admin/settings/payments': 'paymentGateway',
  '/admin/settings/email': 'email',
  '/admin/settings/customer-panel': 'api',
  '/admin/settings/delivery': 'customOrder',
  '/admin/chat/settings': 'liveChat',
};

export const LICENSE_FEATURE_KEY = 'licenseFeature';
