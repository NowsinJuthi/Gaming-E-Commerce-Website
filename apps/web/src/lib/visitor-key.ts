const STORAGE_KEY = "uniqbd:visitor-key";

function randomKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-browser-tab visitor id for live analytics (not PII). */
export function getVisitorKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomKey();
    sessionStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomKey();
  }
}
