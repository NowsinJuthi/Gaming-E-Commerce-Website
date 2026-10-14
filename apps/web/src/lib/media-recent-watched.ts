const STORAGE_KEY = "uniqbd-media-recent";
const MAX_ENTRIES = 32;

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

export function readRecentWatched(): RecentWatchEntry[] {
  if (typeof window === "undefined") return [];
  return parseRecent(localStorage.getItem(STORAGE_KEY));
}

export function touchRecentWatched(titleId: string): void {
  if (typeof window === "undefined" || !titleId) return;
  const now = Date.now();
  const next = [{ id: titleId, at: now }, ...readRecentWatched().filter((entry) => entry.id !== titleId)].slice(
    0,
    MAX_ENTRIES,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("uniqbd-media-recent-changed"));
}
