"use client";
import { hasAuthSession } from "@/lib/access-token";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyAdminPermissions, type AdminPermissions } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PermissionKey } from "@/lib/role-permissions";
import { hasFullBlogPermissions } from "@/lib/role-permissions";

export function hasAdminPermission(
  permissions: AdminPermissions | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(permissions?.[key]);
}

export function useAdminPermissions() {
  const queryClient = useQueryClient();
  const token =
    typeof window !== "undefined" ? hasAuthSession() : false;
  const enabled = Boolean(token);

  const query = useQuery({
    queryKey: queryKeys.admin.permissions.me,
    queryFn: getMyAdminPermissions,
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onAuthChange() {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.permissions.me,
      });
    }
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, [queryClient]);

  const can = (key: PermissionKey) =>
    hasAdminPermission(query.data, key);

  return {
    permissions: query.data,
    isLoading: query.isLoading,
    can,
    canAccessAdminPanel: can("admin_panel_access"),
    canViewBlogOverview: can("view_blog_overview"),
    canViewBlog: can("view_blog_posts"),
    canEditBlog: can("create_edit_blog_posts"),
    canDeleteBlog: can("delete_blog_posts"),
    canPublishBlog: can("publish_blog_posts"),
    canManageBlogCategories: can("manage_blog_categories"),
    canViewAllBlogPosts: hasFullBlogPermissions(can),
  };
}

/** Whether the signed-in user may open the full admin dashboard (/admin). */
export function useCanAccessAdminPanel() {
  const { canAccessAdminPanel, isLoading } = useAdminPermissions();
  return { canAccessAdminPanel, isLoading };
}
