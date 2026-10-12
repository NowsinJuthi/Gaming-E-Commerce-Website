import { getSessionRoles, hasAuthSession } from "@/lib/access-token";
import {
  isEphemeralGuestSession,
  isGuestFromAccessToken,
} from "@/lib/guest-checkout";

export { isGuestFromAccessToken };

/** Whether the current browser session may open live chat. */
export function canAccessLiveChat(allowGuestChat: boolean): boolean {
  if (typeof window === "undefined") return false;

  if (!hasAuthSession()) return false;

  const roles = getSessionRoles();
  if (roles.includes("admin") || roles.includes("support")) {
    return true;
  }

  if (isEphemeralGuestSession() || isGuestFromAccessToken(null)) {
    return allowGuestChat;
  }

  return true;
}
