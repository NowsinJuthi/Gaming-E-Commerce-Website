/**
 * Centralized Redis cache key factory.
 *
 * All key strings used by CacheService must be defined here so they are
 * consistent across services and easy to audit / change in one place.
 */

export const CacheKeys = {
  product: {
    /** Single product detail page. */
    detail: (slug: string): string => `product:detail:${slug.toLowerCase()}`,
    /** Paginated / filtered product list. */
    list: (query: object): string => `product:list:${JSON.stringify(query)}`,
    /** Homepage sections (products grouped by category). */
    homepageSections: (limitPerCategory: number, featuredOnly = false): string =>
      `product:homepage-sections:${limitPerCategory}${featuredOnly ? ':featured' : ''}`,
    /** Prefix covering all `product:list:*` keys. */
    listPrefix: 'product:list:',
    /** Prefix covering all `product:homepage-sections:*` keys. */
    homepageSectionsPrefix: 'product:homepage-sections:',
  },

  cart: {
    /** Per-user shopping cart. */
    user: (userId: string): string => `cart:${userId}`,
  },

  admin: {
    /** Admin dashboard aggregate overview. */
    dashboardOverview: 'admin:dashboard:overview',
    /** Range-based dashboard reports (timeseries, top products, etc.). */
    dashboardReports: (from: string, to: string): string =>
      `admin:dashboard:reports:${from}:${to}`,
    /** Prefix covering all dashboard report cache keys. */
    dashboardReportsPrefix: 'admin:dashboard:reports:',
  },

  settings: {
    /** Global customer-panel / storefront config. TTL: 60 s */
    panel: 'settings:panel',
    /** SEO / meta settings. TTL: 60 s */
    seo: 'settings:seo',
    /** Payment gateway settings. TTL: 60 s */
    payment: 'settings:payment',
  },

  order: {
    /** Order editing lock — prevents concurrent edits. TTL: 120 s */
    lock: (orderId: string): string => `order:lock:${orderId}`,
    /** Prefix covering all order lock keys — used for SCAN. */
    lockPrefix: 'order:lock:',
  },

  publish: {
    /** Last manual publish timestamp (ISO string). No TTL — persists until next publish. */
    lastPublish: 'publish:last',
    /** Prefix covering all product:detail:* keys (cleared on full publish). */
    productDetailPrefix: 'product:detail:',
  },

  telegram: {
    /** Per-room throttle for admin Telegram alerts on new customer chat messages. */
    chatAlertThrottle: (roomId: string): string =>
      `telegram:chat:alert-throttle:${roomId}`,
  },

  /** TTLs in seconds — kept here so they are easy to tune centrally. */
  ttl: {
    orderLock: 120, // 2 minutes — refreshed by frontend heartbeat every 90 s
    productDetail: 120,
    productList: 60,
    productHomepage: 60,
    settingsPanel: 60,
    settingsSeo: 60,
    settingsPayment: 60,
    adminDashboard: 30,
    adminDashboardReports: 60,
    cart: 60 * 60 * 24 * 30, // 30 days
    telegramChatAlert: 5 * 60, // 5 minutes
  },
} as const;
