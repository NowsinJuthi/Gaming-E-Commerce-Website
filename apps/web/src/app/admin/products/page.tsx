"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  BoxIcon,
  CheckIcon,
  GridIcon,
  KeyIcon,
  TagIcon,
} from "@/components/admin/icons";
import {
  adminListProducts,
  deleteProduct,
  updateProduct,
  type AdminProduct,
} from "@/lib/api";
import { getAdminProductAvailableStock } from "@/lib/admin-product-stock";
import { queryKeys } from "@/lib/query-keys";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtersActive = Boolean(search || statusFilter);

  const productsQuery = useQuery({
    queryKey: queryKeys.admin.products.list({
      search: search || undefined,
      status: statusFilter || undefined,
    }),
    queryFn: () =>
      adminListProducts({
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const products = useMemo<AdminProduct[]>(
    () => productsQuery.data ?? [],
    [productsQuery.data],
  );
  const loading = productsQuery.isPending;
  const loadError = productsQuery.isError ? "Could not load products." : null;

  const stats = useMemo(() => {
    const counts = {
      total: products.length,
      active: 0,
      lowStock: 0,
      draft: 0,
    };
    for (const p of products) {
      const status = p.status ?? "draft";
      if (status === "active") counts.active += 1;
      if (status === "draft") counts.draft += 1;
      if (getAdminProductAvailableStock(p) < 5 && status !== "archived") {
        counts.lowStock += 1;
      }
    }
    return counts;
  }, [products]);

  function productThumb(p: AdminProduct) {
    return p.media?.find((m) => m.url)?.url ?? "";
  }

  async function onToggleFeatured(p: AdminProduct) {
    setTogglingId(p._id);
    const next = !p.featured;
    try {
      await updateProduct(p._id, { featured: next });
      queryClient.setQueryData<AdminProduct[]>(
        queryKeys.admin.products.list({
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        (old) =>
          (old ?? []).map((item) =>
            item._id === p._id ? { ...item, featured: next } : item,
          ),
      );
      adminToast(
        next ? `"${p.title}" marked as featured.` : `"${p.title}" removed from featured.`,
        true,
      );
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not update product.", false);
    } finally {
      setTogglingId(null);
    }
  }

  async function onDelete(id: string, title: string) {
    if (
      !confirm(
        `Delete "${title}"? Products without orders are removed permanently. Products with orders are archived instead.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    hideAdminToast();
    try {
      const result = await deleteProduct(id);
      adminToast(
        result.mode === "archived"
          ? "Product archived (it has orders and cannot be permanently removed)."
          : "Product deleted.",
        true,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.products.all,
      });
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not delete product.", false);
    } finally {
      setDeletingId(null);
    }
  }

  const statusOptions = [
    { value: "", label: "Active (hide archived)" },
    { value: "all", label: "All statuses" },
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "out_of_stock", label: "Out of stock" },
    { value: "archived", label: "Archived only" },
  ];

  return (
    <AdminPageLayout
      section="Catalog"
      title="All Products"
      icon={BoxIcon}
      backHref="/admin"
      backLabel="Dashboard"
      heroClassName="cart-page-hero-compact admin-products-page-hero"
      action={
        <Link href="/admin/products/new" className="btn-primary btn-primary-sm">
          + Add product
        </Link>
      }
    >
      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
        </div>
      ) : null}

      <div className="customer-dashboard-page dashboard-page--pro min-w-0 space-y-4">
        <section
          className="customer-dashboard-overview-section admin-products-overview"
          aria-label="Product overview"
        >
          <dl className="customer-dashboard-overview-stats">
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--brand">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <BoxIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">In view</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : stats.total}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {filtersActive ? "Matching current filters" : "All catalog items"}
                </p>
              </div>
            </div>
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--success">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <CheckIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Active</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : stats.active}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Live on storefront
                </p>
              </div>
            </div>
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--amber">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <KeyIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Low stock</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : stats.lowStock}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Under 5 units available
                </p>
              </div>
            </div>
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--muted">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <TagIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Draft</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : stats.draft}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Not published yet
                </p>
              </div>
            </div>
          </dl>
        </section>

        <section
          className="customer-dashboard-recent-orders-section"
          aria-label="Product list"
        >
          <div className="admin-products-toolbar mb-4 space-y-3 px-1">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-3 sm:px-4">
              <div
                className="admin-email-logs-search-row flex min-w-0 w-full flex-row flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto sm:gap-2"
              >
                <label htmlFor="products-search" className="sr-only">
                  Search products
                </label>
                <input
                  id="products-search"
                  type="search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setSearch(searchDraft.trim());
                    }
                  }}
                  placeholder="Title or SKU…"
                  className="admin-input admin-email-logs-search-input min-w-0 flex-1 max-sm:min-w-[3.25rem] sm:flex-1"
                />
                <button
                  type="button"
                  onClick={() => setSearch(searchDraft.trim())}
                  className="panel-3d-btn admin-email-logs-search-btn shrink-0 text-xs"
                >
                  Search
                </button>
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSearchDraft("");
                    }}
                    className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-sm max-sm:hidden sm:px-4"
                  >
                    Clear
                  </button>
                ) : null}

                <div
                  className="hidden shrink-0 self-stretch w-px bg-border/50 sm:block"
                  aria-hidden
                />

                <label htmlFor="products-status" className="sr-only">
                  Filter by status
                </label>
                <div className="min-w-0 flex-1 max-sm:min-w-[4.5rem] sm:min-w-[10rem] sm:flex-none">
                  <AdminSelect
                    id="products-status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="admin-email-logs-status-select w-full min-w-0"
                    options={statusOptions}
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-pro-empty py-10">
              <p className="text-sm text-subtle">Loading products…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="dashboard-pro-empty py-10">
              <span className="dashboard-pro-empty-icon" aria-hidden>
                <GridIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-foreground">
                {filtersActive ? "No products match your filters" : "No products yet"}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {filtersActive
                  ? "Try a different search term or status filter."
                  : "Create your first catalog item to start selling."}
              </p>
              {!filtersActive ? (
                <Link href="/admin/products/new" className="dashboard-pro-btn mt-4">
                  + Add product
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="customer-orders-list">
              {products.map((p) => (
                <AdminProductCard
                  key={p._id}
                  product={p}
                  thumbUrl={productThumb(p)}
                  availableStock={getAdminProductAvailableStock(p)}
                  onToggleFeatured={() => void onToggleFeatured(p)}
                  onDelete={() => void onDelete(p._id, p.title)}
                  togglingFeatured={togglingId === p._id}
                  deleting={deletingId === p._id}
                  disabled={loading || deletingId !== null || togglingId !== null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminPageLayout>
  );
}
