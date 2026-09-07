"use client";

import { useEffect, useRef } from "react";
import { getStoreEventsSocket } from "@/lib/store-events-socket";
import type { StoreEventHandlers, StoreEventName } from "@/lib/store-events-types";

/**
 * Subscribe to one or more /events Socket.IO events.
 *
 * ─── Basic usage ────────────────────────────────────────────────────────────
 *
 * ```tsx
 * useStoreEvents({
 *   "product.updated": ({ id, slug }) => {
 *     // re-fetch or update local state
 *     setProducts(prev => prev.map(p => p.id === id ? { ...p, stale: true } : p));
 *   },
 *   "settings.updated": () => router.refresh(),
 * });
 * ```
 *
 * ─── React Query integration (once @tanstack/react-query is installed) ──────
 *
 * ```tsx
 * const queryClient = useQueryClient();
 * useStoreEvents({
 *   "product.updated": ({ id }) =>
 *     queryClient.invalidateQueries({ queryKey: ["product", id] }),
 *   "category.updated": () =>
 *     queryClient.invalidateQueries({ queryKey: ["categories"] }),
 *   "settings.updated": ({ section }) =>
 *     queryClient.invalidateQueries({ queryKey: ["settings", section] }),
 * });
 * ```
 *
 * ─── Notes ───────────────────────────────────────────────────────────────────
 * - Event names passed on first render determine which events are subscribed.
 *   Adding new keys after mount has no effect (keep the set stable).
 * - Handlers are updated via a ref on every render — always uses the latest
 *   closure without re-subscribing.
 * - Listeners are automatically removed when the component unmounts.
 * - The underlying socket is a module-level singleton; this hook attaches and
 *   detaches listeners without affecting the connection itself.
 */
export function useStoreEvents(handlers: StoreEventHandlers): void {
  // Keep a stable ref so closures always see the latest handler without
  // requiring the effect to re-run (avoids subscribe/unsubscribe churn).
  const handlersRef = useRef<StoreEventHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = getStoreEventsSocket();

    // Capture the event names at mount time (stable set for the lifetime of
    // this hook instance).
    const events = Object.keys(handlers) as StoreEventName[];

    // Create one stable wrapper per event that delegates to the latest ref.
    // This is what we pass to socket.off() during cleanup.
    const wrappers = new Map<
      StoreEventName,
      (payload: unknown) => void
    >();

    for (const event of events) {
      const wrapper = (payload: unknown) => {
        const handler = handlersRef.current[event];
        if (handler) {
          // Type safety is maintained at the callsite through StoreEventHandlers.
          (handler as (p: unknown) => void)(payload);
        }
      };
      wrappers.set(event, wrapper);
      socket.on(event, wrapper);
    }

    return () => {
      for (const [event, wrapper] of wrappers) {
        socket.off(event, wrapper);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty — event names are captured at mount; handlers updated via ref.
}
