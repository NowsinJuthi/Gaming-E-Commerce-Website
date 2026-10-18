import type { RolePermissionProfile } from "@/lib/api";
import { PERMISSION_GROUPS } from "@/lib/role-permissions";

/** Must match API `ADMIN_ROLE_IDS` order (apps/api role-permissions.constants). */
export const ADMIN_ROLE_ORDER = [
  "shop_manager",
  "guest",
  "customer",
  "vip",
  "reseller",
  "affiliate",
  "supplier",
  "subscriber",
  "contributor",
  "author",
  "blogger",
  "editor",
  "content_manager",
  "library_manager",
  "media_uploader",
  "media_support",
  "administrator",
] as const;

const GUEST_PERMISSION_DEFAULTS: Record<string, boolean> = {
  guest_browse_storefront: true,
  guest_use_cart: true,
  guest_checkout: true,
  guest_live_chat: true,
  guest_view_media: true,
};

function allPermissionKeysFalse(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const group of PERMISSION_GROUPS) {
    for (const perm of group.permissions) {
      out[perm.key] = false;
    }
  }
  return out;
}

function buildGuestRoleProfile(): RolePermissionProfile {
  return {
    id: "guest",
    label: "Guest",
    description:
      "Ephemeral checkout and chat sessions — limit what visitors can do before they register.",
    locked: false,
    summary: [
      "Applies to guest checkout and guest chat JWT sessions.",
      "Toggle cart, checkout, chat, and media browsing independently.",
      "Works together with Customer panel guest checkout / chat switches.",
      "No admin panel access.",
    ],
    customized: false,
    permissions: {
      ...allPermissionKeysFalse(),
      ...GUEST_PERMISSION_DEFAULTS,
    },
  };
}

/** Profiles the admin UI can show when the running API build is behind the repo. */
const SUPPLEMENTAL_ROLE_PROFILES: RolePermissionProfile[] = [
  buildGuestRoleProfile(),
];

export type MergedRolesOverview = {
  overview: {
    roleCount: number;
    customizedCount: number;
    adminAccessCount: number;
    roles: RolePermissionProfile[];
    groups: Array<{ id: string; label: string; locked: boolean }>;
  };
  /** Role IDs returned by the API (save/reset only work for these). */
  serverRoleIds: Set<string>;
  /** Canonical roles merged locally because the API did not return them. */
  missingOnServer: string[];
};

export function mergeRolePermissionsOverview(
  fromApi: MergedRolesOverview["overview"],
): MergedRolesOverview {
  const serverRoleIds = new Set(fromApi.roles.map((role) => role.id));
  const byId = new Map(fromApi.roles.map((role) => [role.id, role]));
  const missingOnServer: string[] = [];

  for (const supplemental of SUPPLEMENTAL_ROLE_PROFILES) {
    if (byId.has(supplemental.id)) continue;
    missingOnServer.push(supplemental.id);
    byId.set(supplemental.id, supplemental);
  }

  const roles: RolePermissionProfile[] = [];
  for (const id of ADMIN_ROLE_ORDER) {
    const role = byId.get(id);
    if (role) roles.push(role);
  }
  const orderSet = new Set<string>(ADMIN_ROLE_ORDER);
  for (const role of fromApi.roles) {
    if (!orderSet.has(role.id)) {
      roles.push(role);
    }
  }

  const customizedCount = roles.filter((role) => role.customized).length;
  const adminAccessCount = roles.filter(
    (role) => role.permissions.admin_panel_access,
  ).length;

  return {
    overview: {
      ...fromApi,
      roles,
      roleCount: roles.length,
      customizedCount,
      adminAccessCount,
    },
    serverRoleIds,
    missingOnServer,
  };
}
