"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { CheckIcon, SearchIcon, TagIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
  type Brand,
  type BrandInput,
} from "@/lib/api";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type Form = {
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
};

type StatusFilter = "" | "active" | "inactive";

const EMPTY: Form = {
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
};

function brandInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function countBrandStats(items: Brand[]) {
  let active = 0;
  let withLogo = 0;
  let inactive = 0;
  for (const b of items) {
    const isActive = b.isActive ?? true;
    if (isActive) active += 1;
    else inactive += 1;
    if (b.logoUrl?.trim()) withLogo += 1;
  }
  return {
    total: items.length,
    active,
    withLogo,
    inactive,
  };
}

type BrandStats = {
  total: number;
  active: number;
  withLogo: number;
  inactive: number;
};

function BrandOverviewStats({
  stats,
  filtersActive,
}: {
  stats: BrandStats;
  filtersActive: boolean;
}) {
  const items = [
    {
      key: "total",
      tone: "brand" as const,
      icon: <TagIcon className="h-4 w-4" aria-hidden />,
      label: "Total",
      value: stats.total.toLocaleString(),
      meta: filtersActive ? "Matching current filters" : "All brands in catalog",
    },
    {
      key: "active",
      tone: "success" as const,
      icon: <CheckIcon className="h-4 w-4" aria-hidden />,
      label: "Active",
      value: stats.active.toLocaleString(),
      meta: "Visible on products",
    },
    {
      key: "logo",
      tone: "amber" as const,
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" />
          <path d="M21 15l-5-5L5 19" />
        </svg>
      ),
      label: "With logo",
      value: stats.withLogo.toLocaleString(),
      meta: "Logo URL configured",
    },
    {
      key: "inactive",
      tone: "muted" as const,
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      ),
      label: "Inactive",
      value: stats.inactive.toLocaleString(),
      meta: "Hidden from selection",
    },
  ];

  return (
    <section
      className="customer-dashboard-overview-section admin-brands-overview"
      aria-label="Brand overview"
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

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtersActive = Boolean(search.trim() || statusFilter);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands
      .filter((b) => {
        const active = b.isActive ?? true;
        if (statusFilter === "active" && !active) return false;
        if (statusFilter === "inactive" && active) return false;
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          (b.slug ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brands, search, statusFilter]);

  const catalogStats = useMemo(() => countBrandStats(brands), [brands]);
  const stats = useMemo(() => countBrandStats(filteredBrands), [filteredBrands]);
  const displayStats = filtersActive ? stats : catalogStats;

  const loadBrands = useCallback(
    async (opts?: { silent?: boolean; isCancelled?: () => boolean }) => {
      const stale = () => opts?.isCancelled?.() ?? false;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await listBrands();
        if (!stale()) setBrands(data);
      } catch (err) {
        if (!stale()) {
          if (!opts?.silent) setBrands([]);
          setError(
            err instanceof Error ? err.message : "Could not load brands",
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
    void loadBrands({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadBrands]);

  function setField<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((c) => ({ ...c, [k]: v }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  function editRow(b: Brand) {
    setEditingId(b._id);
    setError(null);
    setForm({
      name: b.name,
      slug: b.slug ?? "",
      logoUrl: b.logoUrl ?? "",
      description: b.description ?? "",
      isActive: b.isActive ?? true,
      metaTitle: b.seo?.metaTitle ?? "",
      metaDescription: b.seo?.metaDescription ?? "",
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    hideAdminToast();
    setSaving(true);
    try {
      const payload: BrandInput = {
        name: form.name.trim(),
        isActive: form.isActive,
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.metaTitle || form.metaDescription) {
        payload.seo = {
          metaTitle: form.metaTitle || undefined,
          metaDescription: form.metaDescription || undefined,
        };
      }
      if (editingId) {
        await updateBrand(editingId, payload);
        adminToast("Brand updated.", true);
      } else {
        await createBrand(payload);
        adminToast("Brand created.", true);
      }
      resetForm();
      await loadBrands({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete brand "${name}"?`)) return;
    setDeletingId(id);
    setError(null);
    hideAdminToast();
    try {
      await deleteBrand(id);
      adminToast("Brand deleted.", true);
      if (editingId === id) resetForm();
      await loadBrands({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminPageLayout
      section="Catalog"
      title="Brands"
      description="Manage product brands, logos, and storefront visibility."
      icon={TagIcon}
      backHref="/admin/products"
      backLabel="Products"
      loading={loading}
      loadingText="Loading brands…"
    >
      {error ? (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
            icon={<TagIcon className="h-4 w-4" />}
            title="Brand directory"
            subtitle={
              loading
                ? "Loading brands…"
                : filtersActive
                  ? `${filteredBrands.length} of ${brands.length} brand${brands.length === 1 ? "" : "s"} shown`
                  : `${brands.length} brand${brands.length === 1 ? "" : "s"} in catalog`
            }
            className="admin-brands-list"
          >
            <BrandOverviewStats
              stats={displayStats}
              filtersActive={filtersActive}
            />

            <div className="admin-products-filters-list">
              <div className="admin-products-filters-row">
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="brands-search" className="admin-products-filter-label">
                    <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                    Search
                  </label>
                  <input
                    id="brands-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or slug…"
                    className="admin-input w-full"
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="brands-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <select
                    id="brands-status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
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
              <div className="admin-products-table-empty">Loading brands…</div>
            ) : filteredBrands.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <TagIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {filtersActive
                    ? "No brands match your filters"
                    : "No brands yet"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try a different search term or status filter."
                    : "Create your first brand using the form below."}
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                <table className="panel-3d-table admin-table--brands w-full text-sm">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Slug</th>
                      <th>SEO</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBrands.map((b) => {
                      const active = b.isActive ?? true;
                      const hasSeo = Boolean(
                        b.seo?.metaTitle?.trim() ||
                          b.seo?.metaDescription?.trim(),
                      );
                      return (
                        <tr
                          key={b._id}
                          className={`text-foreground-muted ${
                            editingId === b._id ? "bg-brand/5" : ""
                          }`}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-black/25">
                                {b.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={b.logoUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full place-items-center text-sm font-semibold text-foreground-muted">
                                    {brandInitial(b.name)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {b.name}
                                </p>
                                {b.description ? (
                                  <p className="truncate text-xs text-subtle">
                                    {b.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="text-subtle">/{b.slug || "—"}</td>
                          <td>
                            {hasSeo ? (
                              <span className="dashboard-pro-status dashboard-pro-status--green">
                                Set
                              </span>
                            ) : (
                              <span className="text-xs text-subtle">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                active
                                  ? "dashboard-pro-status dashboard-pro-status--green"
                                  : "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted"
                              }
                            >
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editRow(b)}
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === b._id}
                                onClick={() => void onDelete(b._id, b.name)}
                                className="dashboard-pro-btn-ghost text-xs text-rose-400 disabled:opacity-50"
                              >
                                {deletingId === b._id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminOrderListCard>

          <form onSubmit={onSave}>
            <ProductFormOrderCard
              className="admin-product-form-section"
              icon={<TagIcon className="h-4 w-4" />}
              title={editingId ? "Edit brand" : "New brand"}
              subtitle={
                editingId
                  ? "Update details and save changes."
                  : brands.length === 0
                    ? "Create your first brand to label products in the catalog."
                    : "Add a brand to label products on the storefront."
              }
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Preview</dt>
                <dd className="admin-product-form-sidebar-fields">
                  <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                      {form.logoUrl.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.logoUrl.trim()}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-base font-semibold text-foreground-muted">
                          {brandInitial(form.name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {form.name.trim() || "Brand preview"}
                      </p>
                      <p className="truncate text-xs text-subtle">
                        {form.slug.trim()
                          ? `/${form.slug.trim()}`
                          : "Slug auto-generated from name"}
                      </p>
                    </div>
                  </div>
                </dd>
              </div>

              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Brand details</dt>
                <dd className="admin-product-form-sidebar-fields space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="brand-name">
                      Name *
                    </label>
                    <input
                      id="brand-name"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="brand-slug">
                      Slug
                    </label>
                    <input
                      id="brand-slug"
                      value={form.slug}
                      onChange={(e) => setField("slug", e.target.value)}
                      placeholder="auto from name"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="brand-logo">
                      Logo URL
                    </label>
                    <input
                      id="brand-logo"
                      value={form.logoUrl}
                      onChange={(e) => setField("logoUrl", e.target.value)}
                      placeholder="https://…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="brand-description">
                      Description
                    </label>
                    <textarea
                      id="brand-description"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Optional short description"
                      className={inputCls}
                    />
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
                          : "Create brand"}
                    </button>
                  </div>
                </dd>
              </div>
            </ProductFormOrderCard>
          </form>
          </>
        }
      />
    </AdminPageLayout>
  );
}
