export const PERMISSION_GROUPS = [
  {
    key: "admin_panel",
    label: "ADMIN PANEL",
    permissions: [
      { key: "admin_panel_access", label: "Admin panel access" },
      { key: "dashboard_analytics", label: "Dashboard & analytics" },
    ],
  },
  {
    key: "catalog",
    label: "CATALOG",
    permissions: [
      { key: "view_products", label: "View products" },
      { key: "create_edit_products", label: "Create & edit products" },
      { key: "delete_deactivate_products", label: "Delete / deactivate products" },
      { key: "submit_product_drafts", label: "Submit product drafts" },
      { key: "gift_card_inventory", label: "Gift card inventory" },
    ],
  },
  {
    key: "blog",
    label: "BLOG",
    permissions: [
      { key: "view_blog_overview", label: "Blog overview" },
      { key: "view_blog_posts", label: "View blog posts" },
      { key: "create_edit_blog_posts", label: "Create & edit blog posts" },
      { key: "publish_blog_posts", label: "Publish & approve blog posts" },
      { key: "delete_blog_posts", label: "Delete blog posts" },
      { key: "manage_blog_categories", label: "Manage blog categories" },
    ],
  },
  {
    key: "sales",
    label: "SALES",
    permissions: [
      { key: "view_all_orders", label: "View all orders" },
      { key: "update_order_status", label: "Update order status" },
      { key: "approve_mfs_payments", label: "Approve MFS payments" },
    ],
  },
  {
    key: "customers",
    label: "CUSTOMERS",
    permissions: [
      { key: "view_customers", label: "View customers" },
      { key: "edit_customers_wallet", label: "Edit customers & wallet" },
      { key: "auto_delivery", label: "Manual Delivery" },
    ],
  },
  {
    key: "security",
    label: "SECURITY",
    permissions: [
      { key: "manage_security_settings", label: "Security settings" },
      { key: "manage_roles_permissions", label: "Roles & permissions" },
      { key: "view_audit_logs", label: "View audit logs" },
    ],
  },
  {
    key: "movie_server_catalog",
    label: "MOVIE SERVER — CATALOG",
    permissions: [
      { key: "view_media_catalog", label: "View media catalog" },
      { key: "play_media_catalog", label: "Play movies & series" },
      { key: "manage_media_catalog", label: "Manage media catalog" },
      { key: "manage_media_collections", label: "Manage collections" },
      { key: "manage_media_genres", label: "Genres & metadata" },
      { key: "manage_media_home", label: "Media homepage" },
    ],
  },
  {
    key: "movie_server_library",
    label: "MOVIE SERVER — LIBRARY & UPLOAD",
    permissions: [
      { key: "manage_media_libraries", label: "Media libraries" },
      { key: "upload_media_files", label: "Upload media files" },
      { key: "manage_media_files", label: "Manage media files" },
      { key: "view_media_playback", label: "Playback & streams" },
    ],
  },
  {
    key: "movie_server_accounts",
    label: "MOVIE SERVER — SUBSCRIPTIONS",
    permissions: [
      { key: "view_media_subscriptions", label: "View media subscriptions" },
      { key: "manage_media_subscriptions", label: "Manage media subscriptions" },
    ],
  },
  {
    key: "guest_storefront",
    label: "GUEST STOREFRONT",
    permissions: [
      { key: "guest_browse_storefront", label: "Browse storefront" },
      {
        key: "guest_checkout",
        label: "Guest cart & checkout (order without account)",
      },
    ],
  },
  {
    key: "live_chat",
    label: "LIVE CHAT",
    permissions: [
      {
        key: "live_chat_picture_upload",
        label: "Allow picture uploads",
      },
      {
        key: "live_chat_without_login",
        label: "Allow live chat without login",
      },
    ],
  },
  {
    key: "settings",
    label: "SETTINGS",
    permissions: [
      { key: "manage_appearance_theme", label: "Appearance & theme" },
      { key: "manage_email_settings", label: "Email settings" },
      { key: "manage_general_settings", label: "General site settings" },
    ],
  },
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];
export type PermissionEntry = PermissionGroup["permissions"][number];

const MOVIE_SERVER_GROUP_KEYS = [
  "movie_server_catalog",
  "movie_server_library",
  "movie_server_accounts",
] as const;

export type RolePermissionPanel =
  | { kind: "single"; group: PermissionGroup }
  | {
      kind: "movie_server";
      sections: Array<{
        key: string;
        label: string;
        permissions: readonly PermissionEntry[];
      }>;
    };

/** Retired toggles — never show in Roles UI (replaced by `play_media_catalog`). */
export const DEPRECATED_ROLE_PERMISSION_KEYS = new Set(["guest_view_media"]);

export function roleUiPermissions(
  permissions: readonly PermissionEntry[],
): PermissionEntry[] {
  return permissions.filter(
    (perm) => !DEPRECATED_ROLE_PERMISSION_KEYS.has(perm.key),
  );
}

/** Flat list of toggles shown for one role (respects movie-server merge). */
export function rolePermissionEntriesForRole(roleId: string): PermissionEntry[] {
  return permissionPanelsForRole(roleId).flatMap((panel) =>
    panel.kind === "single"
      ? roleUiPermissions(panel.group.permissions)
      : panel.sections.flatMap((section) =>
          roleUiPermissions(section.permissions),
        ),
  );
}

export function permissionPanelsForRole(roleId: string): RolePermissionPanel[] {
  const groups = permissionGroupsForRole(roleId);
  const movieSet = new Set<string>(MOVIE_SERVER_GROUP_KEYS);
  const panels: RolePermissionPanel[] = [];
  let movieSections: Extract<
    RolePermissionPanel,
    { kind: "movie_server" }
  >["sections"] = [];

  const flushMovie = () => {
    if (movieSections.length === 0) return;
    panels.push({ kind: "movie_server", sections: movieSections });
    movieSections = [];
  };

  for (const group of groups) {
    if (movieSet.has(group.key)) {
      movieSections.push({
        key: group.key,
        label: group.label,
        permissions: group.permissions,
      });
      continue;
    }
    flushMovie();
    panels.push({ kind: "single", group });
  }
  flushMovie();
  return panels;
}

/** Keys only editable on the Guest role profile (site-wide storefront limits). */
export const GUEST_STOREFRONT_ONLY_PERMISSION_KEYS = new Set([
  "guest_browse_storefront",
  "guest_use_cart",
  "guest_checkout",
  "guest_live_chat",
]);

/** Permission panels shown for a given role profile in admin Roles UI. */
export function permissionGroupsForRole(roleId: string) {
  if (roleId === "guest") {
    const guestFirst = PERMISSION_GROUPS.filter(
      (group) => group.key === "guest_storefront",
    );
    const rest = PERMISSION_GROUPS.filter(
      (group) => group.key !== "guest_storefront",
    );
    return [...guestFirst, ...rest];
  }
  return PERMISSION_GROUPS;
}

export function permissionGroupSubtitle(
  roleId: string,
  groupKey: string,
): string {
  if (groupKey === "guest_storefront") {
    if (roleId === "guest") {
      return "Site-wide limits for visitors without an account. Turn off cart & checkout to block guest ordering.";
    }
    return "Read-only — edit these on the Guest role. Only Guest profile saves apply to the storefront.";
  }
  if (groupKey === "live_chat") {
    if (roleId === "guest") {
      return "Without login applies site-wide to anonymous chat. Picture uploads apply to guest chat sessions.";
    }
    return "Live chat access for users assigned this role profile.";
  }
  if (groupKey === "movie_server" && roleId === "guest") {
    return "Play movies & series controls guest /media browse and playback (site-wide on this profile).";
  }
  return "Toggle access for this role";
}

export const BLOG_PERMISSION_KEYS = PERMISSION_GROUPS.find(
  (group) => group.key === "blog",
)!.permissions.map((permission) => permission.key);

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export function hasFullBlogPermissions(
  can: (key: PermissionKey) => boolean,
): boolean {
  return BLOG_PERMISSION_KEYS.every((key) => can(key));
}
