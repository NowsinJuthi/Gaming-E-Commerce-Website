/**
 * Central registry of real-time event names broadcast via the /events
 * WebSocket namespace.  Keep payloads small — clients use them as
 * cache-invalidation signals and may re-fetch full data over HTTP.
 */
export const AppEvent = {
  // ── Products ──────────────────────────────────────────────────────────────
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductDeleted: 'product.deleted',

  // ── Categories ────────────────────────────────────────────────────────────
  CategoryCreated: 'category.created',
  CategoryUpdated: 'category.updated',
  CategoryDeleted: 'category.deleted',

  // ── Banners / homepage slides ─────────────────────────────────────────────
  BannerUpdated: 'banner.updated',

  // ── Store settings ────────────────────────────────────────────────────────
  SettingsUpdated: 'settings.updated',

  // ── Brands ────────────────────────────────────────────────────────────────
  BrandCreated: 'brand.created',
  BrandUpdated: 'brand.updated',
  BrandDeleted: 'brand.deleted',

  // ── Order locks ───────────────────────────────────────────────────────────
  OrderLocked: 'order.locked',
  OrderUnlocked: 'order.unlocked',

  // ── Publish ───────────────────────────────────────────────────────────────
  SitePublished: 'site.published',
} as const;

export type AppEvent = (typeof AppEvent)[keyof typeof AppEvent];

/** Typed payload for every event — keeps emitter and consumer in sync. */
export interface EventPayloadMap {
  'product.created': { id: string; slug: string; name: string };
  'product.updated': { id: string; slug: string; name: string };
  'product.deleted': { id: string };

  'category.created': { id: string; slug: string; name: string };
  'category.updated': { id: string; slug: string; name: string };
  'category.deleted': { id: string };

  'banner.updated': Record<string, never>;

  'settings.updated': { section?: string };

  'brand.created': { id: string; name: string };
  'brand.updated': { id: string; name: string };
  'brand.deleted': { id: string };

  'site.published': { at: string };

  'order.locked': { orderId: string; userId: string; userName: string };
  'order.unlocked': { orderId: string };
}
