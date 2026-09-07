"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * 30s stale window — data fetched within the last 30 seconds is served
         * from cache without a network request.  Socket events (useStoreEventInvalidation)
         * mark stale immediately and trigger a background refetch, so the UI
         * stays fresh without polling.
         */
        staleTime: 30_000,
        /**
         * Keep unused query data in memory for 5 minutes before garbage
         * collection.  Navigating back to a list page won't flash a loading
         * skeleton if the data is still in cache.
         */
        gcTime: 5 * 60_000,
        /**
         * One automatic retry on network error (e.g. brief API hiccup).
         * Subsequent manual refetches are always allowed.
         */
        retry: 1,
        /**
         * Don't refetch on every window focus — socket events already push
         * invalidations, so polling on focus would be redundant and wasteful
         * for large admin datasets.
         */
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Module-level singleton for the browser — ensures a single QueryClient
// is shared across all renders in the same tab (HMR-safe).
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (isServer) {
    // SSR: always create a fresh client to avoid sharing state between
    // requests when Next.js server-renders Client Components.
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * Root QueryClientProvider.  Place once at the top of the client component
 * tree (ChromeShell) so every child can call useQuery / useQueryClient.
 *
 * DevTools are opt-in (`enableDevtools`) and only for local admin debugging —
 * never on the public storefront or customer account pages.
 */
export function QueryProvider({
  children,
  enableDevtools = false,
}: {
  children: React.ReactNode;
  /** Show React Query DevTools (development + admin routes only). */
  enableDevtools?: boolean;
}) {
  // useState ensures HMR reloads don't create a new QueryClient and flush
  // the cache unexpectedly during development.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && enableDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
