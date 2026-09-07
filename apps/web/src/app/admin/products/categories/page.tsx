"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderTwoColumnLayout } from "@/components/admin/admin-order-page-shell";
import { CheckIcon, BoxIcon, GridIcon, LayersIcon, SearchIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  adminGetCategories,
  createCategory,
  deleteCategory,
  updateCategory,
  type Category,
  type CategoryInput,
} from "@/lib/api";
import { slugify } from "@/lib/slugify";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type Form = {
  name: string;
  slug: string;
  parentId: string;
  order: string;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
};

type CategoryRow = {
  id: string;
  name: string;
  label: string;
  slug: string;
  depth: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  order: number;
};

type StatusFilter = "" | "active" | "inactive";

const EMPTY: Form = {
  name: "",
  slug: "",
  parentId: "",
  order: "0",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
  keywords: "",
};

function categoryNodeId(node: Category): string {
  return node._id ?? (node as Category & { id?: string }).id ?? "";
}

function flattenCategoryRows(nodes: Category[], depth = 0): CategoryRow[] {
  const out: CategoryRow[] = [];
  for (const node of nodes) {
    const id = categoryNodeId(node);
    out.push({
      id,
      name: node.name,
      label: `${"— ".repeat(depth)}${node.name}`,
      slug: node.slug ?? "",
      depth,
      isActive: node.isActive ?? true,
      productCount: node.productCount ?? 0,
      childCount: node.children?.length ?? 0,
      order: node.order ?? 0,
    });
    if (node.children?.length) {
      out.push(...flattenCategoryRows(node.children, depth + 1));
    }
  }
  return out;
}

function findCategoryNode(nodes: Category[], id: string): Category | undefined {
  for (const node of nodes) {
    if (categoryNodeId(node) === id) return node;
    if (node.children) {
      const found = findCategoryNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

type CategoryStats = {
  total: number;
  active: number;
  withProducts: number;
  topLevel: number;
};

function CategoryOverviewStats({ stats }: { stats: CategoryStats }) {
  const items = [
    {
      key: "total",
      tone: "brand" as const,
      icon: <LayersIcon className="h-4 w-4" aria-hidden />,
      label: "Total",
      value: stats.total.toLocaleString(),
      meta: "All categories",
    },
    {
      key: "active",
      tone: "success" as const,
      icon: <CheckIcon className="h-4 w-4" aria-hidden />,
      label: "Active",
      value: stats.active.toLocaleString(),
      meta: "Visible on storefront",
    },
    {
      key: "products",
      tone: "amber" as const,
      icon: <BoxIcon className="h-4 w-4" aria-hidden />,
      label: "With products",
      value: stats.withProducts.toLocaleString(),
      meta: "Assigned catalog items",
    },
    {
      key: "top",
      tone: "brand" as const,
      icon: <GridIcon className="h-4 w-4" aria-hidden />,
      label: "Top level",
      value: stats.topLevel.toLocaleString(),
      meta: "Root categories",
    },
  ];

  return (
    <section
      className="customer-dashboard-overview-section admin-categories-overview"
      aria-label="Category overview"
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

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    productCount: number;
  } | null>(null);
  const [reassignToId, setReassignToId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flattenCategoryRows(tree), [tree]);
  const flat = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        productCount: r.productCount,
      })),
    [rows],
  );
  const filtersActive = Boolean(search.trim() || statusFilter);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    let active = 0;
    let withProducts = 0;
    let topLevel = 0;
    for (const row of rows) {
      if (row.isActive) active += 1;
      if (row.productCount > 0) withProducts += 1;
      if (row.depth === 0) topLevel += 1;
    }
    return {
      total: rows.length,
      active,
      withProducts,
      topLevel,
    };
  }, [rows]);

  const reassignOptions = useMemo(
    () => flat.filter((c) => c.id !== pendingDelete?.id),
    [flat, pendingDelete?.id],
  );

  const loadCategories = useCallback(
    async (opts?: { silent?: boolean; isCancelled?: () => boolean }) => {
      const stale = () => opts?.isCancelled?.() ?? false;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await adminGetCategories();
        if (!stale()) setTree(data);
      } catch (err) {
        if (!stale()) {
          setTree([]);
          setError(
            err instanceof Error ? err.message : "Could not load categories",
          );
        }
      } finally {
        if (!stale() && !opts?.silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadCategories({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadCategories]);

  useEffect(() => {
    if (!pendingDelete) return;
    deleteDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pendingDelete]);

  function setField<K extends keyof Form>(k: K, v: Form[K]) {
    if (k === "slug") {
      setSlugTouched(true);
      setForm((c) => ({ ...c, slug: v as string }));
      return;
    }
    setForm((c) => ({ ...c, [k]: v }));
  }

  const effectiveSlug = slugTouched ? form.slug : slugify(form.name);

  function resetForm() {
    setEditingId(null);
    setSlugTouched(false);
    setForm(EMPTY);
    setError(null);
  }

  function editRow(id: string) {
    const node = findCategoryNode(tree, id);
    if (!node) return;
    setEditingId(id);
    setSlugTouched(true);
    setError(null);
    setForm({
      name: node.name,
      slug: node.slug ?? "",
      parentId: node.parentId ?? "",
      order: String(node.order ?? 0),
      isActive: node.isActive ?? true,
      metaTitle: node.seo?.metaTitle ?? "",
      metaDescription: node.seo?.metaDescription ?? "",
      keywords: (node.seo?.keywords ?? []).join(", "),
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: CategoryInput = {
        name: form.name.trim(),
        isActive: form.isActive,
        order: Number(form.order || 0),
      };
      const slug = (slugTouched ? form.slug : slugify(form.name)).trim();
      if (slug) payload.slug = slug;
      if (!editingId && form.parentId) payload.parentId = form.parentId;
      const keywords = form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      if (editingId || form.metaTitle || form.metaDescription || keywords.length) {
        payload.seo = {
          metaTitle: form.metaTitle || undefined,
          metaDescription: form.metaDescription || undefined,
          keywords: keywords.length ? keywords : undefined,
        };
      }
      if (editingId) {
        await updateCategory(editingId, payload);
        adminToast("Category updated.", true);
      } else {
        await createCategory(payload);
        adminToast("Category created.", true);
      }
      resetForm();
      await loadCategories({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onDelete(
    id: string,
    name: string,
    productCount = 0,
    childCount = 0,
  ) {
    if (!id) {
      setError("Invalid category id.");
      return;
    }
    setError(null);
    hideAdminToast();
    if (childCount > 0) {
      setError(
        `"${name}" has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Delete or move those first.`,
      );
      return;
    }
    if (productCount > 0) {
      const others = flat.filter((c) => c.id !== id);
      setReassignToId(others[0]?.id ?? "");
      setPendingDelete({ id, name, productCount });
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    void runDelete(id);
  }

  async function runDeleteWithAutoFallback(id: string) {
    setDeleting(true);
    setError(null);
    try {
      const created = await createCategory({
        name: "General",
        slug: "general",
        isActive: true,
      });
      const targetId = categoryNodeId(created);
      const result = await deleteCategory(id, { reassignToCategoryId: targetId });
      const moved = result.reassignedProducts ?? 0;
      adminToast(moved > 0
            ? `Category deleted. ${moved} product${moved === 1 ? "" : "s"} moved to General.`
            : "Category deleted.", true);
      setPendingDelete(null);
      setReassignToId("");
      if (editingId === id) resetForm();
      await loadCategories({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not move products and delete",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function runDelete(id: string, reassignToCategoryId?: string) {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteCategory(id, { reassignToCategoryId });
      const moved = result.reassignedProducts ?? 0;
      adminToast(moved > 0
            ? `Category deleted. ${moved} product${moved === 1 ? "" : "s"} moved.`
            : "Category deleted.", true);
      setPendingDelete(null);
      setReassignToId("");
      if (editingId === id) resetForm();
      await loadCategories({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteWithReassign() {
    if (!pendingDelete) return;
    if (reassignToId) {
      void runDelete(pendingDelete.id, reassignToId);
      return;
    }
    if (reassignOptions.length === 0) {
      void runDeleteWithAutoFallback(pendingDelete.id);
      return;
    }
    setError("Choose a category to move products into.");
  }

  function closeDeleteModal() {
    if (deleting) return;
    setPendingDelete(null);
    setReassignToId("");
    setError(null);
  }

  return (
    <AdminPageLayout
      section="Catalog"
      title="Categories"
      description="Organize products into a hierarchical catalog structure."
      icon={LayersIcon}
      backHref="/admin/products"
      backLabel="Products"
      loading={loading}
      loadingText="Loading categories…"
    >
      {error && !pendingDelete ? (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {pendingDelete ? (
        <div ref={deleteDialogRef} className="admin-order-detail-main mb-5">
          <ProductFormOrderCard
            className="admin-product-form-section admin-categories-delete-modal"
            title="Delete category?"
            subtitle={`${pendingDelete.name} has ${pendingDelete.productCount} product${pendingDelete.productCount === 1 ? "" : "s"}. Move them to another category, then delete.`}
          >
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Reassign products</dt>
              <dd className="admin-product-form-sidebar-fields space-y-4">
                {reassignOptions.length > 0 ? (
                  <div>
                    <label className={labelCls} htmlFor="reassign-category">
                      Move products to
                    </label>
                    <select
                      id="reassign-category"
                      value={reassignToId}
                      onChange={(e) => setReassignToId(e.target.value)}
                      className="admin-select w-full"
                    >
                      <option value="">Select category…</option>
                      {reassignOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="admin-categories-delete-notice rounded-xl px-3.5 py-3 text-sm leading-relaxed">
                    This is your only category. A new{" "}
                    <span className="font-semibold text-foreground">General</span>{" "}
                    category will be created and your product will move there
                    automatically.
                  </div>
                )}
                {error ? (
                  <p className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-sm text-rose-300">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={closeDeleteModal}
                    className="dashboard-pro-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={confirmDeleteWithReassign}
                    className="btn-primary disabled:opacity-50"
                  >
                    {deleting
                      ? "Deleting…"
                      : reassignOptions.length === 0
                        ? "Move product & delete"
                        : "Move products & delete"}
                  </button>
                </div>
              </dd>
            </div>
          </ProductFormOrderCard>
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <ProductFormOrderCard
            className="admin-product-form-section"
            icon={<LayersIcon className="h-4 w-4" />}
            title="Category tree"
            subtitle={
              loading
                ? "Loading categories…"
                : `${filteredRows.length} categor${filteredRows.length === 1 ? "y" : "ies"} shown`
            }
          >
            <CategoryOverviewStats stats={stats} />

            <div className="admin-products-filters-list">
              <div className="admin-products-filters-row">
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="categories-search" className="admin-products-filter-label">
                    <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                    Search
                  </label>
                  <input
                    id="categories-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or slug…"
                    className="admin-input w-full"
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="categories-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <select
                    id="categories-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="admin-select w-full"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="admin-products-table-empty">Loading categories…</div>
            ) : filteredRows.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <LayersIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {filtersActive
                    ? "No categories match your filters"
                    : "No categories yet"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try a different search term or status filter."
                    : "Create your first category using the form on the right."}
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                <table className="panel-3d-table panel-3d-table--products admin-table--categories w-full text-sm">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Slug</th>
                      <th>Products</th>
                      <th>Status</th>
                      <th>Order</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`text-foreground-muted ${
                          editingId === row.id ? "bg-brand/5" : ""
                        }`}
                      >
                        <td>
                          <p
                            className="font-medium text-foreground"
                            style={{ paddingLeft: `${row.depth}rem` }}
                          >
                            {row.depth > 0 ? (
                              <span className="mr-1 text-subtle">↳</span>
                            ) : null}
                            {row.name}
                          </p>
                        </td>
                        <td className="text-subtle">/{row.slug || "—"}</td>
                        <td>
                          {row.productCount > 0 ? (
                            <span className="font-medium text-foreground">
                              {row.productCount}
                            </span>
                          ) : (
                            <span className="text-subtle">0</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              row.isActive
                                ? "dashboard-pro-status dashboard-pro-status--green"
                                : "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted"
                            }
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>{row.order}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editRow(row.id)}
                              className="dashboard-pro-btn-ghost text-xs"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDelete(
                                  row.id,
                                  row.name,
                                  row.productCount,
                                  row.childCount,
                                )
                              }
                              disabled={row.childCount > 0}
                              title={
                                row.childCount > 0
                                  ? "Delete subcategories first"
                                  : row.productCount > 0
                                    ? "Move products to another category first"
                                    : undefined
                              }
                              className="dashboard-pro-btn-ghost text-xs text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ProductFormOrderCard>
        }
        sidebar={
          <form onSubmit={onSave}>
            <ProductFormOrderCard
              className="admin-product-form-section"
              icon={<LayersIcon className="h-4 w-4" />}
              title={editingId ? "Edit category" : "New category"}
              subtitle={
                editingId
                  ? "Update details and save changes."
                  : "Add a category to group products on the storefront."
              }
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Category details</dt>
                <dd className="admin-product-form-sidebar-fields space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="category-name">
                      Name *
                    </label>
                    <input
                      id="category-name"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="category-slug">
                      Slug
                    </label>
                    <input
                      id="category-slug"
                      value={effectiveSlug}
                      onChange={(e) => setField("slug", e.target.value)}
                      placeholder="auto from name"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="category-order">
                      Order
                    </label>
                    <input
                      id="category-order"
                      type="number"
                      value={form.order}
                      onChange={(e) => setField("order", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="category-parent">
                      Parent
                    </label>
                    <select
                      id="category-parent"
                      value={form.parentId}
                      onChange={(e) => setField("parentId", e.target.value)}
                      disabled={Boolean(editingId)}
                      className="admin-select w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">None (top level)</option>
                      {flat
                        .filter((c) => c.id !== editingId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                    </select>
                    {editingId ? (
                      <p className="mt-1 text-xs text-subtle">
                        Parent cannot be changed after creation.
                      </p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground-muted">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setField("isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong bg-muted/50 text-teal-500 focus:ring-teal-500/40"
                    />
                    Active on storefront
                  </label>
                </dd>
              </div>

              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>SEO</dt>
                <dd className="admin-product-form-sidebar-fields space-y-4">
                  <input
                    value={form.metaTitle}
                    onChange={(e) => setField("metaTitle", e.target.value)}
                    placeholder="Meta title"
                    className={inputCls}
                  />
                  <textarea
                    rows={2}
                    value={form.metaDescription}
                    onChange={(e) => setField("metaDescription", e.target.value)}
                    placeholder="Meta description"
                    className={inputCls}
                  />
                  <input
                    value={form.keywords}
                    onChange={(e) => setField("keywords", e.target.value)}
                    placeholder="Keywords, comma separated"
                    className={inputCls}
                  />
                </dd>
              </div>

              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Save</dt>
                <dd className="admin-product-form-sidebar-fields">
                  <div className="flex flex-wrap justify-end gap-2.5">
                    {editingId ? (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="dashboard-pro-btn-ghost"
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving
                        ? "Saving…"
                        : editingId
                          ? "Save changes"
                          : "Create category"}
                    </button>
                  </div>
                </dd>
              </div>
            </ProductFormOrderCard>
          </form>
        }
      />
    </AdminPageLayout>
  );
}
