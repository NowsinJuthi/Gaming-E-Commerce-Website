/**
 * Real-time event payloads emitted by the /events Socket.IO namespace.
 * Must stay in sync with the backend's EventPayloadMap in
 * apps/api/src/shared/events/events.types.ts.
 *
 * Keep payloads minimal — they are cache-invalidation signals, not full
 * document snapshots.  Components should re-fetch over HTTP on receipt.
 */
export type StoreEventMap = {
  // ── Products ──────────────────────────────────────────────────────────────
  "product.created": { id: string; slug: string; name: string };
  "product.updated": { id: string; slug: string; name: string };
  "product.deleted": { id: string };

  // ── Categories ────────────────────────────────────────────────────────────
  "category.created": { id: string; slug: string; name: string };
  "category.updated": { id: string; slug: string; name: string };
  "category.deleted": { id: string };

  // ── Banners / homepage slides ─────────────────────────────────────────────
  "banner.updated": Record<string, never>;

  // ── Store settings ────────────────────────────────────────────────────────
  "settings.updated": { section?: string };

  // ── Brands ────────────────────────────────────────────────────────────────
  "brand.created": { id: string; name: string };
  "brand.updated": { id: string; name: string };
  "brand.deleted": { id: string };

  // ── Publish ───────────────────────────────────────────────────────────────
  /** Emitted when an admin manually publishes all pending changes. */
  "site.published": { at: string };

  // ── Order locks ───────────────────────────────────────────────────────────
  /** An admin opened an order for editing. */
  "order.locked": { orderId: string; userId: string; userName: string };
  /** The admin left the order page or the lock expired. */
  "order.unlocked": { orderId: string };
};

export type StoreEventName = keyof StoreEventMap;

export type StoreSocketListenEvents = {
  [E in StoreEventName]: (payload: StoreEventMap[E]) => void;
};

/**
 * Partial map of event → handler for use in useStoreEvents().
 *
 * @example — with vanilla state
 * useStoreEvents({ "product.updated": () => setProducts(await getProducts()) });
 *
 * @example — with React Query (once installed)
 * useStoreEvents({
 *   "product.updated": () => queryClient.invalidateQueries({ queryKey: ["products"] }),
 *   "settings.updated": ({ section }) => {
 *     if (section === "appearance") queryClient.invalidateQueries({ queryKey: ["appearance"] });
 *   },
 * });
 */
export type StoreEventHandlers = {
  [E in StoreEventName]?: (payload: StoreEventMap[E]) => void;
};
