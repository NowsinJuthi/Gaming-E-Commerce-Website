import { getSessionRoles } from "@/lib/access-token";

export function rolesFromAccessToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = token.split(".")[1];
    if (!payload) return [];
    const decoded = JSON.parse(atob(payload)) as { roles?: string[] };
    return Array.isArray(decoded.roles) ? decoded.roles : [];
  } catch {
    return [];
  }
}

const STAFF_ROLES = [
  "shop_manager",
  "author",
  "editor",
  "administrator",
  "admin",
  "support",
] as const;

/** Roles that may use the blog workspace under /admin/blogs without full admin access. */
const BLOG_WORKSPACE_ROLES = ["blogger", "contributor", "author"] as const;

export function hasBlogWorkspaceRole(
  roles?: string[] | null,
  accessToken?: string | null,
): boolean {
  const resolved =
    roles ??
    (accessToken
      ? rolesFromAccessToken(accessToken)
      : getSessionRoles());
  return resolved.some((r) =>
    BLOG_WORKSPACE_ROLES.includes(r as (typeof BLOG_WORKSPACE_ROLES)[number]),
  );
}

export function hasAdminRole(
  roles?: string[] | null,
  accessToken?: string | null,
): boolean {
  if (roles?.some((r) => STAFF_ROLES.includes(r as (typeof STAFF_ROLES)[number]))) return true;
  const tokenRoles = accessToken
    ? rolesFromAccessToken(accessToken)
    : getSessionRoles();
  return tokenRoles.some((r) => STAFF_ROLES.includes(r as (typeof STAFF_ROLES)[number]));
}

/** Alias — both admin and support staff should access the admin panel. */
export const hasStaffRole = hasAdminRole;

/** Admin role only — excludes support staff. */
export function hasStrictAdminRole(
  roles?: string[] | null,
  accessToken?: string | null,
): boolean {
  if (roles?.includes("administrator") || roles?.includes("admin")) return true;
  const tokenRoles = accessToken
    ? rolesFromAccessToken(accessToken)
    : getSessionRoles();
  return (
    tokenRoles.includes("administrator") || tokenRoles.includes("admin")
  );
}

export function isSafeRedirectPath(
  path: string | null | undefined,
): path is string {
  if (!path) return false;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (!decoded.startsWith("/")) return false;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return false;
  if (decoded.includes("://") || decoded.includes("\\")) return false;
  for (let i = 0; i < decoded.length; i += 1) {
    if ((decoded.charCodeAt(i) ?? 32) < 32) return false;
  }
  if (decoded.startsWith("/login") || decoded.startsWith("/register")) {
    return false;
  }
  return true;
}

/** Where to send the user right after a successful login. */
export function getPostLoginRedirect(
  roles?: string[] | null,
  accessToken?: string | null,
  nextPath?: string | null,
): string {
  const safeNext = isSafeRedirectPath(nextPath) ? nextPath : null;

  if (hasAdminRole(roles, accessToken)) {
    if (safeNext?.startsWith("/admin")) return safeNext;
    return "/admin";
  }

  if (
    hasBlogWorkspaceRole(roles, accessToken) &&
    (safeNext?.startsWith("/admin/blogs") ||
      safeNext?.startsWith("/dashboard/blogs"))
  ) {
    if (safeNext.startsWith("/admin/blogs")) {
      return safeNext.replace("/admin/blogs", "/dashboard/blogs");
    }
    return safeNext;
  }

  return safeNext ?? "/dashboard";
}
