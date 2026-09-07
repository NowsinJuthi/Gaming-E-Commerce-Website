/** Blog workspace for customer dashboard (no admin layout switch). */
export const CUSTOMER_BLOG_WORKSPACE_PREFIX = "/dashboard/blogs";

/** Blog workspace under the admin panel. */
export const ADMIN_BLOG_PREFIX = "/admin/blogs";

export function blogWorkspaceBaseFromPath(pathname: string | null): string {
  if (pathname?.startsWith(CUSTOMER_BLOG_WORKSPACE_PREFIX)) {
    return CUSTOMER_BLOG_WORKSPACE_PREFIX;
  }
  return ADMIN_BLOG_PREFIX;
}

export function isCustomerBlogWorkspacePath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith(CUSTOMER_BLOG_WORKSPACE_PREFIX));
}

export function isAdminBlogPath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith(ADMIN_BLOG_PREFIX));
}

export function blogWorkspacePaths(base: string) {
  return {
    base,
    overview: `${base}/overview`,
    create: `${base}/create`,
    categories: `${base}/categories`,
    settings: `${base}/settings`,
    posts: (query?: string) =>
      query && query.length > 0 ? `${base}?${query}` : base,
    edit: (id: string) => `${base}/${encodeURIComponent(id)}/edit`,
  };
}

export function blogWorkspaceNavHref(
  paths: ReturnType<typeof blogWorkspacePaths>,
  segment: "posts" | "create" | "categories" | "settings",
): string {
  if (segment === "posts") return paths.posts();
  return paths[segment];
}

export function mapAdminBlogPathToCustomer(pathname: string): string | null {
  if (!pathname.startsWith(ADMIN_BLOG_PREFIX)) return null;
  return `${CUSTOMER_BLOG_WORKSPACE_PREFIX}${pathname.slice(ADMIN_BLOG_PREFIX.length)}`;
}
