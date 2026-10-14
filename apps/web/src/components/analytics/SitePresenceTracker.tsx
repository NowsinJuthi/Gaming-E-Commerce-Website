"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getLiveAnalyticsSocket } from "@/lib/live-analytics-socket";
import { getVisitorKey } from "@/lib/visitor-key";

const PING_MS = 30_000;

/** Sends visitor heartbeats for the admin live visitor counter. */
export function SitePresenceTracker() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const visitorKey = getVisitorKey();
    if (!visitorKey) return;

    const socket = getLiveAnalyticsSocket();

    const ping = () => {
      if (!socket.connected) return;
      socket.emit("visitor:ping", {
        visitorKey,
        path: pathname,
      });
    };

    ping();
    const id = window.setInterval(ping, PING_MS);
    socket.on("connect", ping);

    return () => {
      window.clearInterval(id);
      socket.off("connect", ping);
    };
  }, [pathname]);

  return null;
}
