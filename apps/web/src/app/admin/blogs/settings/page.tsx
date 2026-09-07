"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderPageIntro } from "@/components/admin/admin-order-page-shell";
import { BlogSettingsPanel } from "@/components/admin/BlogSettingsPanel";
import { SettingsIcon } from "@/components/admin/icons";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { blogWorkspacePaths } from "@/lib/blog-workspace";

export default function AdminBlogSettingsPage() {
  const blogBase = useBlogWorkspaceBase();
  const blogPaths = blogWorkspacePaths(blogBase);
  const { canViewBlogOverview, isLoading: loading } = useAdminPermissions();
  const canView = canViewBlogOverview;

  if (!loading && !canView) {
    return (
      <AdminPageLayout
        section="Content"
        title="Blog settings"
        description="Control likes, reviews, views, and other article page features."
        icon={SettingsIcon}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
      >
        <p className="text-sm text-subtle">
          You do not have permission to view blog settings.
        </p>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Content"
      title="Blog settings"
      description="Turn article page features on or off for the public blog."
      icon={SettingsIcon}
      backHref={blogPaths.overview}
      backLabel="Blog overview"
      loading={loading}
      loadingText="Loading permissions…"
    >
      <AdminOrderPageIntro
        icon={<SettingsIcon className="h-4 w-4" />}
        title="Blog article features"
        subtitle="Likes, reviews, views, author profile, share, and more"
      />

      <BlogSettingsPanel />
    </AdminPageLayout>
  );
}
