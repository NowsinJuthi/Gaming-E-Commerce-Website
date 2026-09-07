import { rolesFromAccessToken } from "@/lib/auth-roles";
import {
  isEphemeralGuestSession,
  isGuestFromAccessToken,
} from "@/lib/guest-checkout";

export { isGuestFromAccessToken };

/** Whether the current browser session may open live chat. */
export function canAccessLiveChat(allowGuestChat: boolean): boolean {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem("accessToken");
  if (!token) return false;

  const roles = rolesFromAccessToken(token);
  if (roles.includes("admin") || roles.includes("support")) {
    return true;
  }

  if (isEphemeralGuestSession() || isGuestFromAccessToken(token)) {
    return allowGuestChat;
  }

  return true;
}
