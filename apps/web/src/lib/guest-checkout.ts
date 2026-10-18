import { hasAuthSession, isGuestAuthSession } from "@/lib/access-token";
import {
  ApiError,
  getCustomerPanelConfig,
  getMe,
  logoutUser,
  setTokens,
  startGuestCheckoutSession,
} from "@/lib/api";
import { isGuestCheckoutEnabled } from "@/lib/guest-permissions";

const CHECKOUT_CONTACT_KEY = "uniqbd_checkout_contact";

export const GUEST_CHECKOUT_KEY = "guestCheckout";

/** True when the JWT belongs to an ephemeral guest (checkout or chat session). */
export function isGuestFromAccessToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload)) as {
      isGuest?: boolean;
      email?: string;
    };
    if (decoded.isGuest === true) return true;
    const email = (decoded.email ?? "").trim().toLowerCase();
    return (
      email.endsWith("@guest.local") ||
      email.startsWith("guest+")
    );
  } catch {
    return false;
  }
}

export function isGuestCheckoutSession(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_CHECKOUT_KEY) === "1";
}

/** Guest checkout or guest chat JWT — not a registered account. */
export function isEphemeralGuestSession(): boolean {
  if (typeof window === "undefined") return false;
  if (isGuestCheckoutSession()) return true;
  return isGuestAuthSession();
}

export function isRegisteredUserLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return hasAuthSession() && !isEphemeralGuestSession();
}

export async function isGuestCheckoutAllowed(
  allowGuestCheckout?: boolean,
): Promise<boolean> {
  if (allowGuestCheckout !== undefined) return allowGuestCheckout === true;
  try {
    const config = await getCustomerPanelConfig();
    return isGuestCheckoutEnabled(config);
  } catch {
    return false;
  }
}

export function clearGuestCheckoutSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_CHECKOUT_KEY);
}

function clearStoredCheckoutContact(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CHECKOUT_CONTACT_KEY);
  }
}

/** Revoke ephemeral guest credentials in the browser. */
export function discardEphemeralGuestSession(): void {
  if (!isEphemeralGuestSession()) return;
  void logoutUser();
  clearStoredCheckoutContact();
}

/** End guest checkout: revoke the server session then clear local tokens so
 *  no guest data remains in the browser for the next visitor. */
export function endGuestCheckoutSession(): void {
  discardEphemeralGuestSession();
}

/** Ensures the browser has a cart session (registered or guest). */
export async function ensureShoppingSession(
  allowGuestCheckout?: boolean,
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const allowed = await isGuestCheckoutAllowed(allowGuestCheckout);
  const token = hasAuthSession();

  if (token && !isEphemeralGuestSession()) {
    return true;
  }

  if (token && isEphemeralGuestSession()) {
    if (!allowed) {
      discardEphemeralGuestSession();
      return false;
    }
    try {
      await getMe();
      return true;
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        discardEphemeralGuestSession();
        return false;
      }
      if (hasAuthSession()) {
        return true;
      }
    }
    return false;
  }

  if (!allowed) return false;

  try {
    const result = await startGuestCheckoutSession();
    setTokens(result.accessToken, result.csrfToken ?? result.refreshToken, {
      guest: true,
      roles: result.user?.roles,
      expiresIn: result.expiresIn,
    });
    return true;
  } catch {
    return false;
  }
}
