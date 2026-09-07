"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlogFormActions, BlogFormFields } from "@/components/admin/blog-form";
import { BlogFormPageLayout } from "@/components/admin/BlogFormPageLayout";
import {
  EMPTY_BLOG_FORM,
  blogPostToForm,
  buildBlogPayload,
  validateBlogForm,
  validateBlogSeoScoreForSubmit,
} from "@/components/admin/blog-form-shared";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import {
  CUSTOMER_BLOG_WORKSPACE_PREFIX,
  blogWorkspacePaths,
} from "@/lib/blog-workspace";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { getAdminBlog, updateBlog } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export default function AdminEditBlogPage() {
  const blogPaths = blogWorkspacePaths(useBlogWorkspaceBase());
  const isCustomerWorkspace = blogPaths.base === CUSTOMER_BLOG_WORKSPACE_PREFIX;
  const blogBaseHref = isCustomerWorkspace
    ? "/dashboard/blogs"
    : "/admin/blogs";
  const formSurface = isCustomerWorkspace ? "customer" : "admin";
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_BLOG_FORM);
  const { canEditBlog, isLoading: permsLoading } = useAdminPermissions();
  const seoSubmitWarning = useMemo(
    () => validateBlogSeoScoreForSubmit(form, "submit"),
    [form],
  );

  const blogQuery = useQuery({
    queryKey: queryKeys.admin.blog.detail(id),
    queryFn: () => getAdminBlog(id),
    enabled: canEditBlog && Boolean(id),
  });

  useEffect(() => {
    if (blogQuery.data) {
      setForm(blogPostToForm(blogQuery.data));
    }
  }, [blogQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildBlogPayload>) =>
      updateBlog(id, payload),
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.blog.all,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
      adminToast(
        post.status === "pending"
          ? `"${post.title}" submitted for review.`
          : post.status === "draft"
            ? `"${post.title}" saved as draft.`
            : `"${post.title}" updated.`,
        true,
      );
      router.push(blogBaseHref);
    },
    onError: (err) => {
      adminToast(
        err instanceof Error ? err.message : "Could not update blog post.",
        false,
      );
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    hideAdminToast();
    const error = validateBlogForm(form, "submit");
    if (error) {
      adminToast(error, false);
      return;
    }
    updateMutation.mutate(buildBlogPayload(form));
  }

  function onSaveDraft() {
    hideAdminToast();
    const draftForm = { ...form, status: "draft" as const };
    const error = validateBlogForm(draftForm, "draft");
    if (error) {
      adminToast(error, false);
      return;
    }
    updateMutation.mutate(buildBlogPayload(draftForm));
  }

  const layoutProps = {
    title: "Edit post",
    backHref: blogPaths.base,
    backLabel: "Blog",
  };

  if (permsLoading) {
    return (
      <BlogFormPageLayout
        isCustomerWorkspace={isCustomerWorkspace}
        iconKey="blog"
        {...layoutProps}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
        loading
        loadingText="Checking access…"
      />
    );
  }

  if (!canEditBlog) {
    return (
      <BlogFormPageLayout
        isCustomerWorkspace={isCustomerWorkspace}
        iconKey="blog"
        {...layoutProps}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
      >
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You do not have permission to edit blog posts.
        </div>
      </BlogFormPageLayout>
    );
  }

  return (
    <BlogFormPageLayout
      isCustomerWorkspace={isCustomerWorkspace}
      iconKey="blog"
      {...layoutProps}
      description={blogQuery.data?.title ?? "Update blog article"}
      loading={blogQuery.isPending}
      loadingText="Loading post…"
    >
      {blogQuery.isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not load this blog post.
        </div>
      ) : null}

      {blogQuery.data?.status === "rejected" &&
      blogQuery.data.rejectionReason ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Rejected: {blogQuery.data.rejectionReason}
        </div>
      ) : null}

      {blogQuery.data?.status === "pending" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This post is pending admin approval and is not visible on the
          storefront yet.
        </div>
      ) : null}

      {blogQuery.data ? (
        <form onSubmit={onSubmit} className="space-y-5">
          <BlogFormFields
            form={form}
            setForm={setForm}
            mode="edit"
            surface={formSurface}
          />
          <BlogFormActions
            saving={updateMutation.isPending}
            submitLabel="Save changes"
            savingLabel="Saving…"
            onCancel={() => router.push(blogBaseHref)}
            onSaveDraft={onSaveDraft}
            surface={formSurface}
            submitDisabled={Boolean(seoSubmitWarning)}
            submitDisabledReason={seoSubmitWarning}
          />
        </form>
      ) : null}
    </BlogFormPageLayout>
  );
}
