import { API_BASE } from "@/lib/api";

export type LiveVisitorRow = {
  visitorKey: string;
  path: string;
  pathLabel?: string | null;
  label: string;
  userId: string | null;
  lastSeen: number;
};

export type LiveMediaRow = {
  visitorKey: string;
  label: string;
  userId: string | null;
  titleId: string;
  titleName: string;
  episodeName: string | null;
  lastSeen: number;
};

export type LiveAnalyticsSnapshot = {
  updatedAt: number;
  visitorCount: number;
  visitors: LiveVisitorRow[];
  mediaSessions: LiveMediaRow[];
};

export const EMPTY_LIVE_SNAPSHOT: LiveAnalyticsSnapshot = {
  updatedAt: 0,
  visitorCount: 0,
  visitors: [],
  mediaSessions: [],
};

export function parseLiveSnapshot(data: unknown): LiveAnalyticsSnapshot {
  if (!data || typeof data !== "object") return EMPTY_LIVE_SNAPSHOT;
  const payload = data as LiveAnalyticsSnapshot;
  return {
    updatedAt: typeof payload.updatedAt === "number" ? payload.updatedAt : Date.now(),
    visitorCount:
      typeof payload.visitorCount === "number"
        ? payload.visitorCount
        : Array.isArray(payload.visitors)
          ? payload.visitors.length
          : 0,
    visitors: Array.isArray(payload.visitors) ? payload.visitors : [],
    mediaSessions: Array.isArray(payload.mediaSessions) ? payload.mediaSessions : [],
  };
}

export async function getLiveAnalyticsSnapshot(): Promise<LiveAnalyticsSnapshot> {
  const res = await fetch(`${API_BASE}/admin/live-analytics/snapshot`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return EMPTY_LIVE_SNAPSHOT;
  return parseLiveSnapshot(await res.json());
}
