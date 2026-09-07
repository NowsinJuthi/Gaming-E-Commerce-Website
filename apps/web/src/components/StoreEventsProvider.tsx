"use client";

import { useEffect } from "react";
import { getStoreEventsSocket } from "@/lib/store-events-socket";
import { useStoreEventInvalidation } from "@/hooks/useStoreEventInvalidation";

/**
 * Eagerly opens the /events Socket.IO connection as soon as the client
 * renders.  Place this once at the root of the app (ChromeShell) so the
 * socket is ready before any child component tries to use useStoreEvents().
 *
 * Why a dedicated provider instead of letting useStoreEvents() create it?
 * — The socket should connect even on pages with no event subscribers so
 *   that the first event fires instantly rather than after the first
 *   subscriber mounts.
 * — Having a single explicit mount point makes connection lifecycle visible.
 *
 * ─── React Query integration (once @tanstack/react-query is installed) ──────
 *
 * Wrap this component (or its parent) in <QueryClientProvider> and pass the
 * queryClient down.  Then use the hooks inside your page components:
 *
 * ```tsx
 * // In any Server/Client component:
 * const queryClient = useQueryClient();
 * useOnStoreEvent("product.updated", ({ id }) =>
 *   queryClient.invalidateQueries({ queryKey: ["products", id] })
 * );
 * ```
 *
 * ─── Next.js router cache invalidation ───────────────────────────────────────
 *
 * For Server Components, call `router.refresh()` to revalidate the page:
 *
 * ```tsx
 * const router = useRouter();
 * useOnStoreEvent("settings.updated", () => router.refresh());
 * ```
 */
export function StoreEventsProvider() {
  // Wire socket events → React Query cache invalidation.
  // Must be called inside QueryProvider (ChromeShell wraps both).
  useStoreEventInvalidation();

  useEffect(() => {
    // Kick off the connection immediately — no-op if already connected.
    const socket = getStoreEventsSocket();

    if (process.env.NODE_ENV === "development") {
      const onConnect = () =>
        console.debug("[StoreEvents] connected", socket.id);
      const onDisconnect = (reason: string) =>
        console.debug("[StoreEvents] disconnected —", reason);
      const onConnectError = (err: Error) =>
        console.debug("[StoreEvents] connect error —", err.message);

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);

      return () => {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
      };
    }

    // Production: no dev listeners, but still keep the teardown path clean.
    return undefined;
  }, []);

  // No UI — this is a behaviour-only component.
  return null;
}
