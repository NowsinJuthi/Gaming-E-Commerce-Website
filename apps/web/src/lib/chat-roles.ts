/** Chat staff roles — mirrors API `CHAT_STAFF_ROLES` + legacy stored values. */
const CHAT_STAFF_ROLE_SET = new Set([
  "admin",
  "administrator",
  "support",
  "editor",
]);

export function isChatStaffRole(role?: string | null): boolean {
  return CHAT_STAFF_ROLE_SET.has(String(role ?? "").toLowerCase());
}

/** Primary role stored on chat messages — mirrors API `primaryRole()`. */
export function primaryChatRole(roles: string[]): string {
  if (roles.some((r) => r === "administrator" || r === "admin")) {
    return "administrator";
  }
  if (roles.some((r) => r === "editor" || r === "support")) {
    return "editor";
  }
  return roles[0] ?? "customer";
}
