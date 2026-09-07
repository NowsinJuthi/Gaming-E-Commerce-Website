"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useStoreEvents } from "@/hooks/useStoreEvents";

/**
 * Mounts once (inside StoreEventsProvider) and wires every /events socket
 * event to the appropriate queryClient.invalidateQueries() calls.
 *
 * ─── Why invalidateQueries instead of setQueryData? ────────────────────────
 * The socket payload is intentionally minimal (id, slug, name) — it is a
 * cache-invalidation signal, not a full document snapshot.  invalidateQueries
 * marks the cached entry stale and triggers a background refetch, which
 * returns the authoritative data from the API.  This avoids partial-update
 * bugs where the client applies an optimistic patch that diverges from what
 * the server persisted.
 *
 * ─── Performance ───────────────────────────────────────────────────────────
 * - Only queries that are currently mounted (active observers) are refetched
 *   immediately.  Inactive cache entries are simply marked stale and refetched
 *   on next use.
 * - Products that share the slug in a list are invalidated at the `lists()`
 *   level (all active list queries refresh) but the product detail is
 *   invalidated by exact slug — unvisited product pages are not fetched.
 * - Admin and storefront keys are separate so an admin edit only refetches
 *   the admin list, not every public product list simultaneously.
 *
 * ─── Server Component pages ────────────────────────────────────────────────
 * Pages rendered as Server Components (homepage, /products, /[slug] categories)
 * are NOT in the React Query cache.  For those, add this in the page's
 * client boundary:
 *
 * ```tsx
 * const router = useRouter();
 * useOnStoreEvent("product.updated", () => router.refresh());
 * useOnStoreEvent("banner.updated",  () => router.refresh());
 * ```
 *
 * router.refresh() re-runs the Server Component tree for the current route
 * without a full navigation — no white flash, no scroll reset.
 */
export function useStoreEventInvalidation(): void {
  const queryClient = useQueryClient();
  const router = useRouter();

  useStoreEvents({
    // ── Products ────────────────────────────────────────────────────────────

    "product.created": () => {
      // New product → invalidate all list views (admin + storefront) and
      // homepage sections so it appears immediately for mounted components.
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.homepage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },

    "product.updated": ({ slug }) => {
      // Precise: only the detail for this slug + all list snapshots (the list
      // might show title / price / stock from the updated doc).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(slug),
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.homepage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },

    "product.deleted": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.homepage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },

    // ── Categories ──────────────────────────────────────────────────────────

    "category.created": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all });
    },

    "category.updated": ({ slug }) => {
      // Precise: invalidate only this category's slug entry + the whole tree
      // (tree structure may have changed — parent moved, order changed).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.bySlug(slug),
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.tree() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all });
    },

    "category.deleted": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all });
    },

    // ── Banners ─────────────────────────────────────────────────────────────

    "banner.updated": () => {
      // Banners live inside the customer panel config.
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.customerPanel() });
    },

    // ── Store settings ───────────────────────────────────────────────────────

    "settings.updated": ({ section }) => {
      if (section) {
        // A known section changed — still invalidate the whole config because
        // sections are served as one blob by /customer-panel/config.
        void queryClient.invalidateQueries({ queryKey: queryKeys.settings.customerPanel() });
      } else {
        // Unknown / broad change — invalidate everything under settings.
        void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      }
    },

    // ── Brands ──────────────────────────────────────────────────────────────

    "brand.created": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.brands.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.brands.all });
      // Products reference brands — a new brand may affect admin product filters
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },

    "brand.updated": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.brands.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.brands.all });
    },

    "brand.deleted": () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.brands.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.brands.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all });
    },

    // ── Full publish ─────────────────────────────────────────────────────────

    "site.published": () => {
      // A full publish clears every Redis key.
      // 1. Force-refetch all currently active React Query observers immediately
      //    (refetchQueries goes further than invalidateQueries for active ones).
      void queryClient.refetchQueries({ type: "active" });
      // 2. Mark inactive (unmounted) queries as stale so they refetch on next use.
      void queryClient.invalidateQueries({ type: "inactive" });
      // 3. Bust the Next.js App Router segment cache so pages rendered with
      //    useEffect/useState (not React Query) also get fresh server data.
      router.refresh();
    },
  });
}
