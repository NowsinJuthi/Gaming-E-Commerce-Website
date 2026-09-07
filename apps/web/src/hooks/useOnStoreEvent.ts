"use client";

import { useEffect, useRef } from "react";
import { getStoreEventsSocket } from "@/lib/store-events-socket";
import type { StoreEventMap, StoreEventName } from "@/lib/store-events-types";

/**
 * Subscribe to a single /events Socket.IO event.
 * Convenience wrapper around useStoreEvents for the common single-event case.
 *
 * @param event  The event name to listen for (must be stable between renders).
 * @param handler  Called with the typed payload each time the event fires.
 *
 * @example
 * ```tsx
 * // Refresh product list whenever any product changes
 * useOnStoreEvent("product.updated", ({ slug }) => {
 *   router.refresh();            // Next.js App Router soft refresh
 * });
 *
 * // With React Query
 * useOnStoreEvent("category.updated", () => {
 *   queryClient.invalidateQueries({ queryKey: ["categories"] });
 * });
 * ```
 */
export function useOnStoreEvent<E extends StoreEventName>(
  event: E,
  handler: (payload: StoreEventMap[E]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getStoreEventsSocket();

    const wrapper = (
      receivedEvent: string,
      payload: StoreEventMap[E],
    ) => {
      if (receivedEvent === event) {
        handlerRef.current(payload);
      }
    };

    socket.onAny(wrapper);

    return () => {
      socket.offAny(wrapper);
    };
  }, [event]); // Re-subscribe only if the event name changes (should be stable).
}
