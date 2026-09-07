import type { PermissionKey } from "@/lib/role-permissions";

export const CUSTOMER_BLOG_NAV_PERMISSIONS: Record<string, PermissionKey> = {
  blog_overview: "view_blog_overview",
  blog: "view_blog_posts",
  blog_create: "create_edit_blog_posts",
  blog_categories: "manage_blog_categories",
  blog_settings: "view_blog_overview",
};

export function getCustomerBlogNavPermission(
  navKey: string,
): PermissionKey | undefined {
  return CUSTOMER_BLOG_NAV_PERMISSIONS[navKey];
}

export function canAccessCustomerBlogNav(
  navKey: string,
  can: (key: PermissionKey) => boolean,
  options: { isStaff: boolean; isLoading: boolean },
): boolean {
  if (!options.isStaff || options.isLoading) return false;
  const permission = getCustomerBlogNavPermission(navKey);
  return Boolean(permission && can(permission));
}
