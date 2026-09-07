"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";

export function useAutoDeliveryAccess() {
  const [canAccess, setCanAccess] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Skip the API round-trip entirely when no session token exists.
    // This prevents a wasted 401 call for every unauthenticated visitor and
    // eliminates the layout shift caused by products appearing after the fetch.
    if (!localStorage.getItem("accessToken")) {
      setLoaded(true);
      return;
    }

    let active = true;
    getMe()
      .then((me) => {
        if (active) setCanAccess(Boolean(me.autoDelivery));
      })
      .catch(() => {
        if (active) setCanAccess(false);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { canAccess, loaded };
}
