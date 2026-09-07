"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { BlogImagePicker } from "@/components/admin/blog-image-picker";
import { CheckIcon, CloseIcon, LayersIcon, SearchIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { slugify } from "@/lib/slugify";
import {
  createBlogCategory,
  deleteBlogCategory,
  listAdminBlogCategories,
  updateBlogCategory,
  type BlogCategory,
  type BlogCategoryInput,
} from "@/lib/api";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import { blogWorkspacePaths } from "@/lib/blog-workspace";
import { queryKeys } from "@/lib/query-keys";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type CategoryStatTone = "brand" | "success" | "muted";

type CategoryOverviewItem = {
  key: string;
  tone: CategoryStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function BlogCategoryOverviewStats({
  items,
}: {
  items: CategoryOverviewItem[];
}) {
  return (
    <section
      className="customer-dashboard-overview-section admin-blog-categories-overview"
      aria-label="Blog category overview"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone}`}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {item.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {item.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {item.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Form = {
  name: string;
  slug: string;
  slugManual: boolean;
  description: string;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
  keywordsInput: string;
  canonicalUrl: string;
  ogImage: string;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  slugManual: false,
  description: "",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
  keywordsInput: "",
  canonicalUrl: "",
  ogImage: "",
};

function parseKeywordsInput(input: string): string[] | undefined {
  const keywords = [
    ...new Set(
      input
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
  return keywords.length > 0 ? keywords : undefined;
}

function keywordsToInput(keywords?: string[]): string {
  return (keywords ?? []).join(", ");
}

function toPayload(form: Form): BlogCategoryInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || slugify(form.name),
    description: form.description.trim(),
    isActive: form.isActive,
    seo: {
      metaTitle: form.metaTitle.trim() || undefined,
      metaDescription: form.metaDescription.trim() || undefined,
      keywords: parseKeywordsInput(form.keywordsInput),
      canonicalUrl: form.canonicalUrl.trim() || undefined,
      ogImage: form.ogImage.trim() || undefined,
    },
  };
}

function categoryToForm(cat: BlogCategory): Form {
  return {
    name: cat.name,
    slug: cat.slug,
    slugManual: true,
    description: cat.description ?? "",
    isActive: cat.isActive ?? true,
    metaTitle: cat.seo?.metaTitle ?? "",
    metaDescription: cat.seo?.metaDescription ?? "",
    keywordsInput: keywordsToInput(cat.seo?.keywords),
    canonicalUrl: cat.seo?.canonicalUrl ?? "",
    ogImage: cat.seo?.ogImage ?? "",
  };
}

export default function AdminBlogCategoriesPage() {
  const blogPaths = blogWorkspacePaths(useBlogWorkspaceBase());
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { canManageBlogCategories, isLoading: permsLoading } =
    useAdminPermissions();

  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.blogCategory.list(),
    queryFn: listAdminBlogCategories,
    enabled: canManageBlogCategories,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogCategory.all });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (!payload.name) throw new Error("Name is required.");
      if (editingId) return updateBlogCategory(editingId, payload);
      return createBlogCategory(payload);
    },
    onSuccess: async (cat) => {
      await invalidate();
      adminToast(`"${cat.name}" saved.`, true);
      setForm(EMPTY);
      setEditingId(null);
    },
    onError: (err) => {
      adminToast(err instanceof Error ? err.message : "Could not save category.", false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlogCategory(id),
    onSuccess: async () => {
      await invalidate();
      adminToast("Category deleted.", true);
      if (editingId) {
        setEditingId(null);
        setForm(EMPTY);
      }
    },
    onError: (err) => {
      adminToast(err instanceof Error ? err.message : "Could not delete.", false);
    },
  });

  const items = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const searchActive = search.trim().length > 0;
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.slug.toLowerCase().includes(q) ||
        (cat.description ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const stats = useMemo(() => {
    let active = 0;
    for (const c of items) {
      if (c.isActive !== false) active += 1;
    }
    return { total: items.length, active, inactive: items.length - active };
  }, [items]);

  const loading = categoriesQuery.isPending;
  const overviewItems = useMemo<CategoryOverviewItem[]>(
    () => [
      {
        key: "total",
        tone: "brand",
        icon: <LayersIcon className="h-4 w-4" />,
        label: "Total categories",
        value: loading ? "…" : String(stats.total),
        meta: "All categories created",
      },
      {
        key: "active",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Active",
        value: loading ? "…" : String(stats.active),
        meta: "Currently published",
      },
      {
        key: "inactive",
        tone: "muted",
        icon: <CloseIcon className="h-4 w-4" />,
        label: "Inactive",
        value: loading ? "…" : String(stats.inactive),
        meta: "Hidden from storefront",
      },
    ],
    [loading, stats],
  );

  function patch(values: Partial<Form>) {
    setForm((current) => {
      const next = { ...current, ...values };
      if (!next.slugManual && "name" in values) {
        next.slug = slugify(next.name);
      }
      return next;
    });
  }

  function startEdit(cat: BlogCategory) {
    setEditingId(cat.id);
    setForm(categoryToForm(cat));
    hideAdminToast();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    hideAdminToast();
    if (!form.name.trim()) {
      adminToast("Name is required.", false);
      return;
    }
    saveMutation.mutate();
  }

  if (permsLoading) {
    return (
      <AdminPageLayout
        section="Content"
        title="Blog categories"
        icon={LayersIcon}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
        loading
        loadingText="Checking access…"
      />
    );
  }

  if (!canManageBlogCategories) {
    return (
      <AdminPageLayout
        section="Content"
        title="Blog categories"
        icon={LayersIcon}
        backHref={blogPaths.overview}
        backLabel="Blog overview"
      >
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You do not have permission to manage blog categories.
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Content"
      title="Blog categories"
      description="Organize blog posts with named categories and SEO metadata."
      icon={LayersIcon}
      backHref={blogPaths.base}
      backLabel="Blog"
      loading={categoriesQuery.isPending}
      loadingText="Loading categories…"
    >
      <BlogCategoryOverviewStats items={overviewItems} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ProductFormOrderCard
          title={editingId ? "Edit category" : "New category"}
          subtitle="Name, slug, and SEO"
        >
          <form onSubmit={onSubmit} className="admin-product-form-sidebar-fields space-y-4">
            <div>
              <label htmlFor="cat-name" className={labelCls}>Name *</label>
              <input
                id="cat-name"
                className={inputCls}
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className={labelCls}>Slug</label>
              <input
                id="cat-slug"
                className={inputCls}
                value={form.slug}
                onChange={(e) => patch({ slug: slugify(e.target.value), slugManual: true })}
              />
            </div>
            <div>
              <label htmlFor="cat-desc" className={labelCls}>Description</label>
              <textarea
                id="cat-desc"
                className={`${inputCls} min-h-[72px] resize-y`}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
              />
              Active
            </label>
            <div>
              <label htmlFor="cat-meta-title" className={labelCls}>Meta title</label>
              <input
                id="cat-meta-title"
                className={inputCls}
                value={form.metaTitle}
                onChange={(e) => patch({ metaTitle: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="cat-meta-desc" className={labelCls}>Meta description</label>
              <textarea
                id="cat-meta-desc"
                className={`${inputCls} min-h-[72px] resize-y`}
                value={form.metaDescription}
                onChange={(e) => patch({ metaDescription: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="cat-keywords" className={labelCls}>Keywords</label>
              <input
                id="cat-keywords"
                className={inputCls}
                value={form.keywordsInput}
                onChange={(e) => patch({ keywordsInput: e.target.value })}
                placeholder="gaming, gift cards, guides"
              />
            </div>
            <div>
              <label htmlFor="cat-canonical" className={labelCls}>Canonical URL</label>
              <input
                id="cat-canonical"
                className={inputCls}
                value={form.canonicalUrl}
                onChange={(e) => patch({ canonicalUrl: e.target.value })}
                placeholder="https://uniqbd.com/blog/category/gaming"
              />
            </div>
            <BlogImagePicker
              id="cat-og-image"
              label="OG image"
              value={form.ogImage}
              onChange={(ogImage) => patch({ ogImage })}
              hint="Used for social sharing on category archive pages."
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-primary btn-primary-sm"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : editingId
                    ? "Update category"
                    : "Create category"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY);
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </ProductFormOrderCard>

        <AdminOrderListCard
          icon={<LayersIcon className="h-4 w-4" />}
          title="All categories"
          subtitle={
            searchActive
              ? `${filteredItems.length} of ${items.length} categor${items.length === 1 ? "y" : "ies"} matching`
              : `${items.length} categor${items.length === 1 ? "y" : "ies"}`
          }
        >
          {items.length > 0 ? (
            <div className="admin-products-filters-list mb-4">
              <div className="admin-products-filter-field w-full">
                <label
                  htmlFor="blog-categories-search"
                  className="admin-products-filter-label"
                >
                  <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                  Search
                </label>
                <input
                  id="blog-categories-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type name or slug…"
                  className="admin-input w-full"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="text-sm text-subtle">No categories yet.</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-subtle">
              No categories match &ldquo;{search.trim()}&rdquo;. Try a different
              search term.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredItems.map((cat) => (
                <li
                  key={cat.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-xs text-subtle">/{cat.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-secondary-sm"
                      onClick={() => startEdit(cat)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-secondary-sm text-rose-300"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (!confirm(`Delete "${cat.name}"?`)) return;
                        deleteMutation.mutate(cat.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminOrderListCard>
      </div>
    </AdminPageLayout>
  );
}
