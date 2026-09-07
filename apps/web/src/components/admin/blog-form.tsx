"use client";

import { useMemo } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminBlogSeoScorePanel } from "@/components/admin/AdminBlogSeoScorePanel";
import { BlogCategorySearchSelect } from "@/components/admin/BlogCategorySearchSelect";
import { BlogImagePicker } from "@/components/admin/blog-image-picker";
import { BlogCanonicalUrlGuide } from "@/components/admin/BlogCanonicalUrlGuide";
import { BlogImageUploadGuide } from "@/components/admin/BlogImageUploadGuide";
import { CONTACT_EMAIL_CARD_SURFACE_CLASS } from "@/components/contact/contact-email-card";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  type BlogFormState,
  blogStatusOptions,
} from "@/components/admin/blog-form-shared";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import { blogWorkspacePaths } from "@/lib/blog-workspace";
import { BLOG_IMAGE_TARGET_SIZE_LABEL } from "@/lib/blog-image-spec";
import { slugify } from "@/lib/slugify";
import { listAdminBlogCategories, uploadBlogImage, type BlogCategory } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type BlogFormFieldsProps = {
  form: BlogFormState;
  setForm: React.Dispatch<React.SetStateAction<BlogFormState>>;
  mode: "create" | "edit";
  /** Customer dashboard uses Email Support elevated card surfaces. */
  surface?: "admin" | "customer";
};

function blogFormSectionClass(surface: "admin" | "customer"): string {
  if (surface !== "customer") return "";
  return `${CONTACT_EMAIL_CARD_SURFACE_CLASS} blog-form-customer-card p-5 sm:p-6`;
}

export function BlogFormFields({
  form,
  setForm,
  surface = "admin",
}: BlogFormFieldsProps) {
  const blogPaths = blogWorkspacePaths(useBlogWorkspaceBase());
  const { canManageBlogCategories, canPublishBlog } = useAdminPermissions();
  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.blogCategory.all,
    queryFn: listAdminBlogCategories,
    staleTime: 60_000,
  });

  const categoryOptions = (categoriesQuery.data ?? [])
    .filter((c: BlogCategory) => c.isActive !== false);

  function patch(values: Partial<BlogFormState>) {
    setForm((current) => {
      const next = { ...current, ...values };
      if (
        !next.slugManual &&
        ("title" in values || values.slugManual === false)
      ) {
        next.slug = slugify(next.title);
      }
      return next;
    });
  }

  const seoScoreInput = useMemo(
    () => ({
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      content: form.content,
      featuredImage: form.featuredImage,
      ogImage: form.ogImage,
      categoryId: form.categoryId,
      tagsInput: form.tagsInput,
      focusKeyword: form.focusKeyword,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      canonicalUrl: form.canonicalUrl,
      status: form.status,
    }),
    [form],
  );

  function autoGenerateSeo() {
    const title = form.title.trim();
    const excerpt = form.excerpt.trim();
    patch({
      ...(!form.metaTitle.trim() && title
        ? { metaTitle: title.slice(0, 60) }
        : {}),
      ...(!form.metaDescription.trim() && excerpt
        ? { metaDescription: excerpt.slice(0, 160) }
        : {}),
      ...(!form.focusKeyword.trim() && title
        ? {
            focusKeyword: title
              .split(/\s+/)
              .filter((w) => w.length > 2)
              .slice(0, 1)
              .join(" ")
              .toLowerCase(),
          }
        : {}),
      ...(!form.ogImage.trim() && form.featuredImage.trim()
        ? { ogImage: form.featuredImage.trim() }
        : {}),
    });
  }

  const sectionClass = blogFormSectionClass(surface);

  return (
    <div className="space-y-5">
      <ProductFormOrderCard
        className={sectionClass}
        title="Post details"
        subtitle="Core blog content"
      >
        <div className="admin-product-form-sidebar-fields space-y-4">
          <div>
            <label htmlFor="blog-title" className={labelCls}>
              Title *
            </label>
            <input
              id="blog-title"
              className={inputCls}
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="How to buy game top-ups safely"
              required
            />
          </div>

          <div>
            <label htmlFor="blog-slug" className={labelCls}>
              Slug *
            </label>
            <input
              id="blog-slug"
              className={inputCls}
              value={form.slug}
              onChange={(e) =>
                patch({ slug: slugify(e.target.value), slugManual: true })
              }
              placeholder="how-to-buy-game-top-ups-safely"
              required
            />
            <p className="mt-1 text-xs text-subtle">
              Public URL: /blog/{form.slug || "your-slug"}
            </p>
          </div>

          <div>
            <label htmlFor="blog-excerpt" className={labelCls}>
              Short description *
            </label>
            <textarea
              id="blog-excerpt"
              className={`${inputCls} min-h-[88px] resize-y`}
              value={form.excerpt}
              onChange={(e) => patch({ excerpt: e.target.value })}
              placeholder="A concise summary shown on the blog listing card."
              required
            />
          </div>

          <div>
            <label className={labelCls}>Content *</label>
            <RichTextEditor
              value={form.content}
              onChange={(content) => patch({ content })}
              minHeight="200px"
              placeholder="Write the full article…"
              onImageUpload={async (file) => {
                const { url } = await uploadBlogImage(file);
                return url;
              }}
            />
          </div>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className={sectionClass}
        title="Media & taxonomy"
        subtitle="Image, category, tags"
      >
        <div className="admin-product-form-sidebar-fields space-y-4">
          <BlogImageUploadGuide />

          <BlogImagePicker
            id="blog-featured-image"
            label="Featured image"
            value={form.featuredImage}
            onChange={(featuredImage) => patch({ featuredImage })}
            required
            hint={`আপলোড বা URL পেস্ট করুন। ছবি অটো WebP-তে ${BLOG_IMAGE_TARGET_SIZE_LABEL} px-এ কনভার্ট হয়। / Upload or paste a URL. Images are auto-converted to WebP at ${BLOG_IMAGE_TARGET_SIZE_LABEL} px.`}
          />

          <div>
            <label htmlFor="blog-category" className={labelCls}>
              Category *
            </label>
            <BlogCategorySearchSelect
              id="blog-category"
              value={form.categoryId}
              onChange={(categoryId) => patch({ categoryId })}
              categories={categoryOptions}
              disabled={categoriesQuery.isPending}
            />
            <p className="mt-1 text-xs text-subtle">
              {canManageBlogCategories ? (
                <>
                  Manage categories under{" "}
                  <a
                    href={blogPaths.categories}
                    className="text-brand hover:underline"
                  >
                    Blog categories
                  </a>
                  .
                </>
              ) : (
                "Ask an administrator to assign blog category permissions."
              )}
            </p>
          </div>

          <div>
            <label htmlFor="blog-tags" className={labelCls}>
              Tags
            </label>
            <input
              id="blog-tags"
              className={inputCls}
              value={form.tagsInput}
              onChange={(e) => patch({ tagsInput: e.target.value })}
              placeholder="gaming, gift cards, tips"
            />
            <p className="mt-1 text-xs text-subtle">Comma-separated tags.</p>
          </div>

          <div>
            <label htmlFor="blog-author" className={labelCls}>
              Author
            </label>
            <input
              id="blog-author"
              className={`${inputCls} opacity-80`}
              value={form.authorDisplay || "Loading author…"}
              readOnly
              disabled
            />
          </div>

          <div>
            <label htmlFor="blog-status" className={labelCls}>
              Status *
            </label>
            <AdminSelect
              id="blog-status"
              value={form.status}
              onChange={(value) =>
                patch({ status: value as BlogFormState["status"] })
              }
              options={blogStatusOptions(canPublishBlog)}
            />
            {!canPublishBlog ? (
              <p className="mt-1 text-xs text-subtle">
                Posts submitted for review stay pending until an editor approves
                them. Editing a live post sends it back for approval.
              </p>
            ) : null}
          </div>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className={sectionClass}
        title="SEO"
        subtitle="Search and social metadata."
        action={
          <button
            type="button"
            onClick={autoGenerateSeo}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Auto-generate
          </button>
        }
      >
        <div className="admin-product-form-sidebar-fields space-y-4">
          <AdminBlogSeoScorePanel input={seoScoreInput} />

          <div>
            <label htmlFor="blog-meta-title" className={labelCls}>
              Meta title
            </label>
            <input
              id="blog-meta-title"
              className={inputCls}
              value={form.metaTitle}
              onChange={(e) => patch({ metaTitle: e.target.value })}
              placeholder={form.title || "SEO title"}
              maxLength={70}
            />
            <p className="mt-1 text-[11px] text-subtle">
              {form.metaTitle.length}/60 recommended
            </p>
          </div>

          <div>
            <label htmlFor="blog-meta-description" className={labelCls}>
              Meta description
            </label>
            <textarea
              id="blog-meta-description"
              className={`${inputCls} min-h-[88px] resize-y`}
              value={form.metaDescription}
              onChange={(e) => patch({ metaDescription: e.target.value })}
              placeholder={form.excerpt || "SEO description"}
              maxLength={180}
            />
            <p className="mt-1 text-[11px] text-subtle">
              {form.metaDescription.length}/160 recommended
            </p>
          </div>

          <div>
            <label htmlFor="blog-focus-keyword" className={labelCls}>
              Focus keyword
            </label>
            <input
              id="blog-focus-keyword"
              className={inputCls}
              value={form.focusKeyword}
              onChange={(e) => patch({ focusKeyword: e.target.value })}
              placeholder="digital gift cards"
            />
          </div>

          <div>
            <label htmlFor="blog-canonical" className={labelCls}>
              Canonical URL
            </label>
            <BlogCanonicalUrlGuide slug={form.slug} />
            <input
              id="blog-canonical"
              className={`${inputCls} mt-2`}
              value={form.canonicalUrl}
              onChange={(e) => patch({ canonicalUrl: e.target.value })}
              placeholder="https://uniqbd.com/blog/your-slug"
            />
          </div>

          <BlogImagePicker
            id="blog-og-image"
            label="OG image"
            value={form.ogImage}
            onChange={(ogImage) => patch({ ogImage })}
            placeholder={form.featuredImage || "/api/uploads/blog/og.webp"}
            hint="Social share image. Falls back to featured image when empty."
          />
        </div>
      </ProductFormOrderCard>
    </div>
  );
}

type BlogFormActionsProps = {
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  onCancel?: () => void;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  savingDraftLabel?: string;
  surface?: "admin" | "customer";
  submitDisabled?: boolean;
  submitDisabledReason?: string | null;
};

export function BlogFormActions({
  saving,
  submitLabel,
  savingLabel,
  onCancel,
  onSaveDraft,
  saveDraftLabel = "Save as draft",
  savingDraftLabel = "Saving draft…",
  surface = "admin",
  submitDisabled = false,
  submitDisabledReason = null,
}: BlogFormActionsProps) {
  const wrapClass =
    surface === "customer"
      ? `${CONTACT_EMAIL_CARD_SURFACE_CLASS} blog-form-customer-card flex flex-col flex-wrap items-stretch gap-3 p-5 sm:p-6`
      : "flex flex-col flex-wrap items-stretch gap-3";

  return (
    <div className={wrapClass}>
      {submitDisabled && submitDisabledReason ? (
        <p
          className="w-full rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200"
          role="alert"
        >
          {submitDisabledReason}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={surface === "customer" ? "btn-primary" : "btn-primary btn-primary-sm"}
          disabled={saving || submitDisabled}
        >
          {saving ? savingLabel : submitLabel}
        </button>
        {onSaveDraft ? (
          <button
            type="button"
            className={surface === "customer" ? "btn-secondary" : "btn-secondary btn-secondary-sm"}
            disabled={saving}
            onClick={onSaveDraft}
          >
            {saving ? savingDraftLabel : saveDraftLabel}
          </button>
        ) : null}
      </div>
      {onCancel ? (
        <button
          type="button"
          className={surface === "customer" ? "btn-secondary" : "btn-secondary btn-secondary-sm"}
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
