const STORAGE_KEY = "uniqbd-media-recent";
const LEGACY_PREFIX = "uniqbd-watch:";
const MAX_ENTRIES = 32;
const MIN_RESUME_SECONDS = 8;

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
