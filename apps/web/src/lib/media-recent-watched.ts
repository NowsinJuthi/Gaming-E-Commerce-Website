const STORAGE_KEY = "uniqbd-media-recent";
const SNAPSHOT_KEY = "uniqbd-media-recent-snapshots";
const LEGACY_PREFIX = "uniqbd-watch:";
const DURATION_PREFIX = "uniqbd-watch-dur:";
const MAX_ENTRIES = 32;
const MIN_RESUME_SECONDS = 8;

export type RecentCardSnapshot = {
  id: string;
  title: string;
  year: number | null;
  kind: "movie" | "series";
  posterUrl: string | null;
  runtimeMinutes?: number | null;
};

function readSnapshotRecord(): Record<string, RecentCardSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    const out: Record<string, RecentCardSnapshot> = {};
    for (const [id, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== "object") continue;
      const snap = entry as Partial<RecentCardSnapshot>;
      if (typeof snap.title !== "string" || !id) continue;
      out[id] = {
        id,
        title: snap.title,
        year: typeof snap.year === "number" ? snap.year : null,
        kind: snap.kind === "series" ? "series" : "movie",
        posterUrl: typeof snap.posterUrl === "string" ? snap.posterUrl : null,
        runtimeMinutes:
          typeof snap.runtimeMinutes === "number" && snap.runtimeMinutes > 0 ? snap.runtimeMinutes : null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeSnapshotRecord(next: Record<string, RecentCardSnapshot>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
}

/** Keep poster/title in localStorage so Recently Watched can paint without waiting on the API. */
export function persistRecentSnapshot(snapshot: RecentCardSnapshot): void {
  if (typeof window === "undefined" || !snapshot.id || !snapshot.title.trim()) return;
  const recentIds = new Set(readRecentWatched().map((entry) => entry.id));
  if (!recentIds.has(snapshot.id)) return;
  const record = readSnapshotRecord();
  record[snapshot.id] = snapshot;
  const trimmed: Record<string, RecentCardSnapshot> = {};
  for (const id of recentIds) {
    if (record[id]) trimmed[id] = record[id];
  }
  writeSnapshotRecord(trimmed);
}

export function hydrateRecentCards(
  entries: RecentWatchEntry[],
  catalog?: Map<string, { id: string; title: string; year: number | null; kind: "movie" | "series"; posterUrl: string | null }>,
): RecentCardSnapshot[] {
  const snapshots = readSnapshotRecord();
  return entries.map((entry) => {
    const fromCatalog = catalog?.get(entry.id);
    const snap = snapshots[entry.id];
    const runtimeMinutes = snap?.runtimeMinutes ?? null;
    if (fromCatalog) {
      return {
        id: fromCatalog.id,
        title: fromCatalog.title,
        year: fromCatalog.year,
        kind: fromCatalog.kind,
        posterUrl: fromCatalog.posterUrl,
        runtimeMinutes,
      };
    }
    if (snap) return { ...snap, runtimeMinutes };
    return {
      id: entry.id,
      title: "",
      year: null,
      kind: "movie" as const,
      posterUrl: null,
      runtimeMinutes: null,
    };
  });
}

export function readWatchPositionSeconds(titleId: string): number {
  if (typeof window === "undefined" || !titleId) return 0;
  const seconds = Number(localStorage.getItem(`${LEGACY_PREFIX}${titleId}`) || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export function persistWatchProgress(titleId: string, seconds: number, durationSeconds: number): void {
  if (typeof window === "undefined" || !titleId || seconds < MIN_RESUME_SECONDS) return;
  localStorage.setItem(`${LEGACY_PREFIX}${titleId}`, String(Math.floor(seconds)));
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    localStorage.setItem(`${DURATION_PREFIX}${titleId}`, String(Math.floor(durationSeconds)));
  }
}

/** Progress 0–100 for Recently Watched bar; optional runtime fallback when duration was not saved yet. */
export function watchProgressPercent(titleId: string, runtimeMinutes?: number | null): number {
  const seconds = readWatchPositionSeconds(titleId);
  if (seconds < MIN_RESUME_SECONDS) return 0;
  let duration = Number(localStorage.getItem(`${DURATION_PREFIX}${titleId}`) || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes * 60 : 0;
  }
  if (duration <= 0) return 6;
  return Math.min(100, Math.max(2, (seconds / duration) * 100));
}

export type RecentWatchEntry = {
  id: string;
  at: number;
};

function parseRecent(raw: string | null): RecentWatchEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const id = "id" in entry && typeof entry.id === "string" ? entry.id : "";
        const at = "at" in entry && typeof entry.at === "number" ? entry.at : 0;
        if (!id) return null;
        return { id, at };
      })
      .filter((entry): entry is RecentWatchEntry => entry !== null);
  } catch {
    return [];
  }
}

function legacyWatchEntries(): RecentWatchEntry[] {
  if (typeof window === "undefined") return [];
  const out: RecentWatchEntry[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(LEGACY_PREFIX)) continue;
    const id = key.slice(LEGACY_PREFIX.length).trim();
    if (!id) continue;
    const seconds = Number(localStorage.getItem(key) || 0);
    if (!Number.isFinite(seconds) || seconds < MIN_RESUME_SECONDS) continue;
    out.push({ id, at: 0 });
  }
  return out;
}

function mergeRecentEntries(primary: RecentWatchEntry[], extra: RecentWatchEntry[]): RecentWatchEntry[] {
  const seen = new Set<string>();
  const merged: RecentWatchEntry[] = [];
  for (const entry of [...primary, ...extra]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged.slice(0, MAX_ENTRIES);
}

/** Pull ids from older per-title resume keys into the recent list (one-time merge). */
export function syncRecentFromLegacyWatchKeys(): RecentWatchEntry[] {
  if (typeof window === "undefined") return [];
  const stored = parseRecent(localStorage.getItem(STORAGE_KEY));
  const legacy = legacyWatchEntries();
  if (legacy.length === 0) return stored;
  const knownIds = new Set(stored.map((entry) => entry.id));
  const missing = legacy.filter((entry) => !knownIds.has(entry.id));
  if (missing.length === 0) return stored;
  const now = Date.now();
  const hydrated = missing.map((entry, index) => ({
    id: entry.id,
    at: now - index - 1,
  }));
  const next = mergeRecentEntries(stored, hydrated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function readRecentWatched(): RecentWatchEntry[] {
  if (typeof window === "undefined") return [];
  const stored = parseRecent(localStorage.getItem(STORAGE_KEY));
  if (stored.length > 0) return stored;
  return syncRecentFromLegacyWatchKeys();
}

export function touchRecentWatched(titleId: string): void {
  if (typeof window === "undefined" || !titleId) return;
  const now = Date.now();
  const next = mergeRecentEntries(
    [{ id: titleId, at: now }],
    readRecentWatched().filter((entry) => entry.id !== titleId),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("uniqbd-media-recent-changed"));
}
