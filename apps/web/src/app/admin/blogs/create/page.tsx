"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlogFormActions, BlogFormFields } from "@/components/admin/blog-form";
import { BlogFormPageLayout } from "@/components/admin/BlogFormPageLayout";
import {
  EMPTY_BLOG_FORM,
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
import { createBlog, getMe } from "@/lib/api";
import { userProfileToAuthorName } from "@/lib/blog-author";
import { queryKeys } from "@/lib/query-keys";

export default function AdminCreateBlogPage() {
  const blogPaths = blogWorkspacePaths(useBlogWorkspaceBase());
  const isCustomerWorkspace = blogPaths.base === CUSTOMER_BLOG_WORKSPACE_PREFIX;
  const blogBaseHref = isCustomerWorkspace
    ? "/dashboard/blogs"
    : "/admin/blogs";
  const formSurface = isCustomerWorkspace ? "customer" : "admin";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_BLOG_FORM);
  const { canEditBlog, canPublishBlog, isLoading: permsLoading } =
    useAdminPermissions();
  const seoSubmitWarning = useMemo(
    () => validateBlogSeoScoreForSubmit(form, "submit"),
    [form],
  );

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildBlogPayload>) =>
      createBlog(payload),
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
            : `"${post.title}" created.`,
        true,
      );
      router.push(blogBaseHref);
    },
    onError: (err) => {
      adminToast(
        err instanceof Error ? err.message : "Could not create blog post.",
        false,
      );
    },
  });

  useEffect(() => {
    if (permsLoading || !canEditBlog) return;
    let cancelled = false;
    void getMe()
      .then((me) => {
        if (cancelled) return;
        setForm((current) => ({
          ...current,
          authorDisplay: userProfileToAuthorName(me),
        }));
      })
      .catch(() => {
        /* author field falls back to placeholder */
      });
    return () => {
      cancelled = true;
    };
  }, [permsLoading, canEditBlog]);

  useEffect(() => {
    if (!permsLoading && canEditBlog && !canPublishBlog) {
      setForm((current) =>
        current.status === "draft" ? { ...current, status: "pending" } : current,
      );
    }
  }, [permsLoading, canEditBlog, canPublishBlog]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    hideAdminToast();
    const error = validateBlogForm(form, "submit");
    if (error) {
      adminToast(error, false);
      return;
    }
    createMutation.mutate(buildBlogPayload(form));
  }

  function onSaveDraft() {
    hideAdminToast();
    const draftForm = { ...form, status: "draft" as const };
    const error = validateBlogForm(draftForm, "draft");
    if (error) {
      adminToast(error, false);
      return;
    }
    createMutation.mutate(buildBlogPayload(draftForm));
  }

  const layoutProps = {
    title: "Create Post",
    backHref: blogPaths.base,
    backLabel: "Blog",
  };

  if (permsLoading) {
    return (
      <BlogFormPageLayout
        isCustomerWorkspace={isCustomerWorkspace}
        iconKey="blog_create"
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
        iconKey="blog_create"
        {...layoutProps}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
      >
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You do not have permission to create blog posts.
        </div>
      </BlogFormPageLayout>
    );
  }

  return (
    <BlogFormPageLayout
      isCustomerWorkspace={isCustomerWorkspace}
      iconKey="blog_create"
      {...layoutProps}
      description="Write a new article for the public blog."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <BlogFormFields
          form={form}
          setForm={setForm}
          mode="create"
          surface={formSurface}
        />
        <BlogFormActions
          saving={createMutation.isPending}
          submitLabel={
            !canPublishBlog && form.status === "pending"
              ? "Submit for review"
              : "Create Post"
          }
          savingLabel={
            !canPublishBlog && form.status === "pending"
              ? "Submitting…"
              : "Creating…"
          }
          onCancel={() => router.push(blogBaseHref)}
          onSaveDraft={onSaveDraft}
          surface={formSurface}
          submitDisabled={Boolean(seoSubmitWarning)}
          submitDisabledReason={seoSubmitWarning}
        />
      </form>
    </BlogFormPageLayout>
  );
}
