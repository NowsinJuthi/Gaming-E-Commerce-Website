import { Role } from '../enums';

/** All assignable role slugs accepted by user create/update APIs. */
export const ASSIGNABLE_USER_ROLES = Object.values(Role) as Role[];

const ASSIGNABLE_USER_ROLE_SET = new Set<string>(ASSIGNABLE_USER_ROLES);

export const ADMINISTRATOR_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Administrator,
];

export const EDITOR_STAFF_ROLES: readonly Role[] = [Role.Support, Role.Editor];

export const CHAT_STAFF_ROLES: readonly Role[] = [
  ...ADMINISTRATOR_ROLES,
  ...EDITOR_STAFF_ROLES,
];

/** Roles that may access the admin panel by default (permission profile defaults). */
export const ADMIN_PANEL_ROLES: readonly Role[] = [
  Role.ShopManager,
  Role.Author,
  Role.Editor,
  Role.ContentManager,
  Role.LibraryManager,
  Role.MediaUploader,
  Role.MediaSupport,
  Role.Support,
  Role.Administrator,
  Role.Admin,
];

export function normalizeAssignedRoles(roles: string[]): Role[] {
  const out = new Set<Role>();
  for (const role of roles) {
    if (role === Role.Admin) {
      out.add(Role.Administrator);
      continue;
    }
    if (role === Role.Support) {
      out.add(Role.Editor);
      continue;
    }
    if (ASSIGNABLE_USER_ROLE_SET.has(role)) {
      out.add(role as Role);
    }
  }
  return out.size ? [...out] : [Role.Customer];
}

export function isAdministratorRole(role: string): boolean {
  return (ADMINISTRATOR_ROLES as readonly string[]).includes(role);
}

export function userHasRole(userRoles: string[], required: Role): boolean {
  if (required === Role.Admin || required === Role.Administrator) {
    return userRoles.some((role) => isAdministratorRole(role));
  }
  if (required === Role.Support || required === Role.Editor) {
    return userRoles.some((role) =>
      (EDITOR_STAFF_ROLES as readonly string[]).includes(role),
    );
  }
  return userRoles.includes(required);
}

export function userHasAnyRequiredRole(
  userRoles: string[],
  required: Role[],
): boolean {
  return required.some((role) => userHasRole(userRoles, role));
}

export function isChatStaff(userRoles: string[]): boolean {
  return userRoles.some((role) =>
    (CHAT_STAFF_ROLES as readonly string[]).includes(role),
  );
}

/** Expand a filter role to include legacy stored values. */
export function expandRoleFilter(role: string): string[] {
  if (role === Role.Administrator) return [Role.Administrator, Role.Admin];
  if (role === Role.Editor) return [Role.Editor, Role.Support];
  return [role];
}
