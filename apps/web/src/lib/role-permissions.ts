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
      { key: "guest_use_cart", label: "Use cart" },
      { key: "guest_checkout", label: "Guest checkout" },
      { key: "guest_live_chat", label: "Guest live chat" },
      { key: "guest_view_media", label: "Browse media catalog" },
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

/** Permission panels shown for a given role profile in admin Roles UI. */
export function permissionGroupsForRole(roleId: string) {
  if (roleId === "guest") {
    return PERMISSION_GROUPS.filter((group) => group.key === "guest_storefront");
  }
  return PERMISSION_GROUPS.filter((group) => group.key !== "guest_storefront");
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
