"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { dispatchAdminPageRefresh } from "@/lib/admin-refresh";

/**
 * Admin header refresh — re-fetches react-query caches, notifies listeners,
 * then reloads the page so client-only admin screens pick up fresh API data.
 */
export function useAdminHeaderRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    dispatchAdminPageRefresh();
    router.refresh();
    void queryClient.refetchQueries({ type: "active" });
    window.location.reload();
  }, [refreshing, router, queryClient]);

  return { refreshing, refresh };
}
