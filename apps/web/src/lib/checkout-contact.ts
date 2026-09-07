import type { UserProfile } from "@/lib/api";
import { isGuestCheckoutSession } from "@/lib/guest-checkout";

export type CheckoutContact = {
  fullName: string;
  mobile: string;
  email: string;
};

const STORAGE_KEY = "uniqbd_checkout_contact";

/**
 * Returns true for any system-generated / anonymised email that should never
 * appear in checkout contact fields.  Mirrors the server-side
 * `isEphemeralGuestUser` helper and the admin soft-delete pattern.
 *
 * Patterns covered:
 *   guest+<id>@guest.local     — ephemeral guest session (active)
 *   guest+<id>@removed.local   — ephemeral guest after finalizeEphemeralGuest
 *   deleted+<id>@removed.local — soft-deleted registered account
 *   guest_<anything>           — legacy guest prefix
 */
function isSystemEmail(email: string | undefined | null): boolean {
  const n = (email ?? "").trim().toLowerCase();
  if (!n) return false;
  return (
    n.endsWith("@guest.local") ||
    n.endsWith("@removed.local") ||
    n.startsWith("guest+") ||
    n.startsWith("deleted+") ||
    n.startsWith("guest_")
  );
}

function displayNameFromProfile(profile: UserProfile | null): string {
  if (!profile || isSystemEmail(profile.email)) return "";
  const p = profile.profile;
  if (p?.displayName?.trim()) return p.displayName.trim();
  const full = [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
  const emailLocal = profile.email?.split("@")[0]?.trim();
  return full || emailLocal || "";
}

export function loadCheckoutContact(): CheckoutContact | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutContact>;
    const contact: CheckoutContact = {
      fullName: String(parsed.fullName ?? "").trim(),
      mobile: String(parsed.mobile ?? "").trim(),
      email: String(parsed.email ?? "").trim(),
    };
    // Discard any previously-saved entry that contains a system / anonymised
    // email (deleted accounts, ephemeral guests after finalisation, etc.)
    if (isSystemEmail(contact.email)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!contact.fullName && !contact.mobile && !contact.email) return null;
    return contact;
  } catch {
    return null;
  }
}

export function saveCheckoutContact(contact: CheckoutContact): void {
  if (typeof window === "undefined") return;
  // Never persist anything during a guest session — the form fields belong
  // to an ephemeral user and must not pre-fill for whoever visits next.
  if (isGuestCheckoutSession()) {
    return;
  }
  const trimmed: CheckoutContact = {
    fullName: contact.fullName.trim(),
    mobile: contact.mobile.trim(),
    email: contact.email.trim(),
  };
  // Never persist a system / anonymised email into the shared localStorage key.
  if (isSystemEmail(trimmed.email)) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  if (!trimmed.fullName && !trimmed.mobile && !trimmed.email) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/** Wipe any cached contact — call when a guest session ends so the next
 *  visitor (registered or guest) starts with a clean slate. */
export function clearSavedCheckoutContact(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Saved checkout contact first, then profile defaults for empty fields. */
export function resolveCheckoutContact(
  profile: UserProfile | null,
): CheckoutContact {
  // Guest sessions must always start with an empty form — we must not
  // pre-fill from a previous registered user's stored contact or from the
  // ephemeral guest profile (which has a fake system email / generated name).
  if (isGuestCheckoutSession()) {
    // Also wipe any stale data that may have been left from a previous session
    // so the next non-guest visitor also starts clean.
    clearSavedCheckoutContact();
    return { fullName: "", mobile: "", email: "" };
  }

  const saved = loadCheckoutContact();

  // For registered users, only use the profile email if it is a real address.
  const profileEmail = isSystemEmail(profile?.email) ? "" : (profile?.email?.trim() ?? "");

  if (saved) {
    return {
      fullName: saved.fullName || displayNameFromProfile(profile),
      mobile: saved.mobile || profile?.phone?.trim() || "",
      email: saved.email || profileEmail,
    };
  }
  return {
    fullName: displayNameFromProfile(profile),
    mobile: profile?.phone?.trim() ?? "",
    email: profileEmail,
  };
}
