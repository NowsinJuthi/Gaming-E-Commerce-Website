"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getLiveAnalyticsSocket } from "@/lib/live-analytics-socket";
import { getVisitorKey } from "@/lib/visitor-key";

const PING_MS = 30_000;
const WATCH_PATH = /^\/media\/watch\/([^/?#]+)/;

function watchTitleId(path: string): string | null {
  const match = path.match(WATCH_PATH);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

/** Sends visitor heartbeats for the admin live visitor counter. */
export function SitePresenceTracker() {
  const pathname = usePathname() ?? "/";
  const [pathLabel, setPathLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    const titleId = watchTitleId(pathname);
    setPathLabel(undefined);
    if (!titleId) return;

    let cancelled = false;
    void fetch(`${API_BASE}/media/titles/${encodeURIComponent(titleId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { title?: string; year?: number } | null) => {
        if (cancelled || !data?.title?.trim()) return;
        const year = typeof data.year === "number" && data.year > 0 ? ` (${data.year})` : "";
        setPathLabel(`${data.title.trim()}${year}`);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const visitorKey = getVisitorKey();
    if (!visitorKey) return;

    const socket = getLiveAnalyticsSocket();

    const ping = () => {
      if (!socket.connected) return;
      socket.emit("visitor:ping", {
        visitorKey,
        path: pathname,
        ...(pathLabel ? { pathLabel } : {}),
      });
    };

    ping();
    const id = window.setInterval(ping, PING_MS);
    socket.on("connect", ping);

    return () => {
      window.clearInterval(id);
      socket.off("connect", ping);
    };
  }, [pathname, pathLabel]);

  return null;
}
