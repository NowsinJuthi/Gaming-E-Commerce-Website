import { attachAffiliateReferral, trackAffiliateClick } from "@/lib/api";

const STORAGE_KEY = "uniqbd_ref";

export function storeReferralCode(code: string): void {
  if (!code.trim()) return;
  localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredReferralCode(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function captureReferralFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;

  storeReferralCode(ref);
  await trackAffiliateClick(ref, window.location.pathname).catch(() => {});

  params.delete("ref");
  const next = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, "", next);
}

export async function attachStoredReferral(): Promise<void> {
  const code = getStoredReferralCode();
  if (!code || !localStorage.getItem("accessToken")) return;
  try {
    await attachAffiliateReferral(code);
    clearStoredReferralCode();
  } catch {
    // invalid code or already referred — keep UX silent
  }
}
