import type { RolePermissionProfile } from "@/lib/api";
import { PERMISSION_GROUPS } from "@/lib/role-permissions";

/** Retired — never show in Roles UI (use `movie_server` instead). */
export const LEGACY_REMOVED_ROLE_IDS = new Set([
  "content_manager",
  "library_manager",
  "media_uploader",
  "media_support",
]);

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
  "movie_server",
  "administrator",
] as const;

const GUEST_PERMISSION_DEFAULTS: Record<string, boolean> = {
  guest_browse_storefront: true,
  guest_use_cart: true,
  guest_checkout: true,
  guest_view_media: true,
  live_chat_without_login: true,
  live_chat_picture_upload: true,
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

const MOVIE_SERVER_PERMISSION_DEFAULTS: Record<string, boolean> = {
  admin_panel_access: true,
  dashboard_analytics: true,
  view_media_catalog: true,
  play_media_catalog: true,
  manage_media_catalog: true,
  manage_media_collections: true,
  manage_media_genres: true,
  manage_media_home: true,
  manage_media_libraries: true,
  upload_media_files: true,
  manage_media_files: true,
  view_media_playback: true,
  view_media_subscriptions: true,
  manage_media_subscriptions: true,
  live_chat_picture_upload: true,
};

function buildMovieServerRoleProfile(): RolePermissionProfile {
  return {
    id: "movie_server",
    label: "Movie Server",
    description:
      "Full Movie Server staff — catalog, libraries, uploads, playback, and subscriptions.",
    locked: false,
    summary: [
      "Manage movies, series, collections, genres, and /media homepage.",
      "Configure libraries, upload files, and manage media storage.",
      "Monitor playback streams and media subscription accounts.",
      "No shop catalog, orders, or site-wide security settings by default.",
    ],
    customized: false,
    permissions: {
      ...allPermissionKeysFalse(),
      ...MOVIE_SERVER_PERMISSION_DEFAULTS,
    },
  };
}

function buildGuestRoleProfile(): RolePermissionProfile {
  return {
    id: "guest",
    label: "Guest",
    description:
      "Ephemeral checkout and chat sessions — limit what visitors can do before they register.",
    locked: false,
    summary: [
      "Site-wide limits for visitors without an account.",
      "Cart and checkout are one permission; browse must stay on for shop access.",
      "Live chat toggles are under LIVE CHAT on this profile.",
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
  buildMovieServerRoleProfile(),
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
  const apiRoles = fromApi.roles.filter(
    (role) => !LEGACY_REMOVED_ROLE_IDS.has(role.id),
  );
  const serverRoleIds = new Set(apiRoles.map((role) => role.id));
  const byId = new Map(apiRoles.map((role) => [role.id, role]));
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
  for (const role of apiRoles) {
    if (!orderSet.has(role.id) && !LEGACY_REMOVED_ROLE_IDS.has(role.id)) {
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
