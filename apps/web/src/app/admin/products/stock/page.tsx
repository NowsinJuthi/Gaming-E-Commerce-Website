"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { InventoryCodeList } from "@/components/admin/InventoryCodeList";
import { BoxIcon, CheckIcon, CloseIcon, PulseIcon, SearchIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  addInventory,
  adminListProducts,
  deleteUnassignedInventoryCodes,
  getStock,
  type AdminProduct,
  type InventoryCodeStatus,
  type PackageStock,
  type ProductStatusValue,
} from "@/lib/api";
import { getAdminProductAvailableStock } from "@/lib/admin-product-stock";
import {
  inventoryManagedPackages,
  isAutoDeliveryStockProduct,
  packageHasInventory,
  UNASSIGNED_INVENTORY_SCOPE,
} from "@/lib/inventory-packages";
import type { ProductVariation } from "@/components/admin/product-variations";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type StockFilter = "" | "in_stock" | "low" | "out";

const STATUS_STYLE: Record<string, string> = {
  draft: "dashboard-pro-status dashboard-pro-status--amber",
  active: "dashboard-pro-status dashboard-pro-status--green",
  out_of_stock: "dashboard-pro-status dashboard-pro-status--amber",
  archived:
    "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  out_of_stock: "Out of stock",
  archived: "Archived",
};

const TYPE_LABEL: Record<string, string> = {
  license: "License",
  account: "Account",
  giftcard: "Gift card",
  topup: "Top-up",
  subscription: "Subscription",
};

function productThumb(p: AdminProduct) {
  return p.media?.find((m) => m.url)?.url ?? "";
}

function formatProductTypeDelivery(
  p: Pick<AdminProduct, "type" | "deliveryType">,
) {
  return `${TYPE_LABEL[p.type] ?? p.type} · ${p.deliveryType ?? "auto"} delivery`;
}

function formatStatus(status: string) {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

function stockTone(available: number, status: string) {
  if (status === "archived") return "text-foreground-muted";
  if (available <= 0) return "text-rose-300 font-semibold";
  if (available < 5) return "text-amber-300 font-semibold";
  return "text-foreground";
}

function stockLevelBadge(available: number, status: string) {
  if (status === "archived") {
    return {
      label: "Archived",
      className:
        "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted",
    };
  }
  if (available <= 0) {
    return {
      label: "Out of stock",
      className: "dashboard-pro-status dashboard-pro-status--amber",
    };
  }
  if (available < 5) {
    return {
      label: "Low stock",
      className: "dashboard-pro-status dashboard-pro-status--amber",
    };
  }
  return {
    label: "In stock",
    className: "dashboard-pro-status dashboard-pro-status--green",
  };
}

function countStockStats(items: AdminProduct[]) {
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  for (const p of items) {
    const available = getAdminProductAvailableStock(p);
    const archived = (p.status ?? "draft") === "archived";
    if (archived) continue;
    if (available <= 0) outOfStock += 1;
    else {
      inStock += 1;
      if (available < 5) lowStock += 1;
    }
  }
  return {
    total: items.length,
    inStock,
    lowStock,
    outOfStock,
  };
}

function parseDeliverables(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function inventoryPackages(product: AdminProduct): ProductVariation[] {
  return inventoryManagedPackages(product);
}

type InventoryStatTone = "brand" | "success" | "amber" | "muted";

function inventoryOverviewStatClass(tone: InventoryStatTone, active = false) {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "w-full text-left",
    active ? "customer-dashboard-overview-stat--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AdminStockPage() {
  const searchParams = useSearchParams();
  const urlProductId = searchParams.get("productId");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("");
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageStocks, setPackageStocks] = useState<PackageStock[]>([]);
  const [unassignedStock, setUnassignedStock] = useState<{
    available: number;
    reserved: number;
    sold: number;
  } | null>(null);
  const [purgingUnassigned, setPurgingUnassigned] = useState(false);
  const [showUnassignedCodes, setShowUnassignedCodes] = useState(false);
  const [stock, setStock] = useState<{
    available: number;
    reserved: number;
    sold: number;
  } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [values, setValues] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    "" | InventoryCodeStatus
  >("available");
  const selectRequestRef = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const inventoryCodesRef = useRef<HTMLDivElement>(null);
  const autoSelectRef = useRef<string | null>(null);

  const focusInventoryView = useCallback((status: "" | InventoryCodeStatus) => {
    setInventoryStatusFilter(status);
    inventoryCodesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  const filtersActive = Boolean(search.trim() || stockFilter);
  const deliverableCount = useMemo(() => parseDeliverables(values).length, [values]);
  const selectedThumb = selected ? productThumb(selected) : "";
  const selectedPackages = useMemo(
    () => (selected ? inventoryPackages(selected) : []),
    [selected],
  );
  const activePackage = useMemo(() => {
    if (!selectedPackageId) return null;
    return (
      selectedPackages.find((pkg) => pkg.valueId === selectedPackageId) ??
      packageStocks.find((pkg) => pkg.valueId === selectedPackageId) ??
      null
    );
  }, [selectedPackageId, selectedPackages, packageStocks]);

  const stockedPackageTabs = useMemo(() => {
    return selectedPackages.filter((pkg) => {
      const row = packageStocks.find((stock) => stock.valueId === pkg.valueId);
      return packageHasInventory(row);
    });
  }, [selectedPackages, packageStocks]);

  const emptyPackageOptions = useMemo(() => {
    return selectedPackages.filter((pkg) => {
      const row = packageStocks.find((stock) => stock.valueId === pkg.valueId);
      return !packageHasInventory(row);
    });
  }, [selectedPackages, packageStocks]);

  const requiresPackageSelection = selectedPackages.length > 0;
  const packageSelectionReady =
    !requiresPackageSelection || Boolean(selectedPackageId);

  const autoDeliveryProducts = useMemo(
    () => products.filter((p) => isAutoDeliveryStockProduct(p)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return autoDeliveryProducts
      .filter((p) => {
        const available = getAdminProductAvailableStock(p);
        const archived = (p.status ?? "draft") === "archived";
        if (stockFilter === "in_stock" && (available <= 0 || archived)) {
          return false;
        }
        if (
          stockFilter === "low" &&
          (available <= 0 || available >= 5 || archived)
        ) {
          return false;
        }
        if (stockFilter === "out" && (available > 0 || archived)) {
          return false;
        }
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.slug ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [autoDeliveryProducts, search, stockFilter]);

  const hasCatalogProducts = autoDeliveryProducts.length > 0;
  const isOnboarding =
    !loading && !hasCatalogProducts && !filtersActive;

  const catalogStats = useMemo(
    () => countStockStats(autoDeliveryProducts),
    [autoDeliveryProducts],
  );
  const stats = useMemo(
    () => countStockStats(filteredProducts),
    [filteredProducts],
  );
  const displayStats = filtersActive ? stats : catalogStats;

  const loadProducts = useCallback(
    async (opts?: { silent?: boolean; isCancelled?: () => boolean }) => {
      const stale = () => opts?.isCancelled?.() ?? false;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const items = await adminListProducts();
        if (!stale()) setProducts(items);
      } catch {
        if (!stale()) {
          if (!opts?.silent) setProducts([]);
          setError("Could not load products.");
        }
      } finally {
        if (!stale() && !opts?.silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadProducts({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadProducts]);

  useEffect(() => {
    if (
      selected &&
      !autoDeliveryProducts.some((p) => p._id === selected._id)
    ) {
      setSelected(null);
      setStock(null);
      setSelectedPackageId(null);
      setPackageStocks([]);
      setUnassignedStock(null);
      setShowUnassignedCodes(false);
    }
  }, [autoDeliveryProducts, selected]);

  function clearSelection() {
    setSelected(null);
    setStock(null);
    setSelectedPackageId(null);
    setPackageStocks([]);
    setUnassignedStock(null);
    setShowUnassignedCodes(false);
    setValues("");
    setCost("");
  }

  function clearFilters() {
    setSearch("");
    setStockFilter("");
  }

  const loadStockForSelection = useCallback(
    async (product: AdminProduct, packageId?: string | null) => {
      const inventoryPkgs = inventoryPackages(product);

      const [detail, scopedForRequest] = await Promise.all([
        getStock(product._id),
        packageId ? getStock(product._id, packageId) : Promise.resolve(null),
      ]);

      const packages = detail.packages ?? [];
      const stockedIds = new Set(
        packages
          .filter((row) => packageHasInventory(row))
          .map((row) => row.valueId),
      );

      let resolvedPackageId = packageId ?? null;
      if (
        resolvedPackageId &&
        !inventoryPkgs.some((pkg) => pkg.valueId === resolvedPackageId)
      ) {
        resolvedPackageId = null;
      }
      if (
        resolvedPackageId &&
        stockedIds.size > 0 &&
        !stockedIds.has(resolvedPackageId)
      ) {
        resolvedPackageId = null;
      }
      if (!resolvedPackageId && stockedIds.size > 0) {
        const firstStocked = inventoryPkgs.find((pkg) =>
          stockedIds.has(pkg.valueId),
        );
        resolvedPackageId = firstStocked?.valueId ?? null;
      }
      if (!resolvedPackageId && inventoryPkgs.length > 0) {
        resolvedPackageId = inventoryPkgs[0]?.valueId ?? null;
      }

      setSelectedPackageId(resolvedPackageId);
      setPackageStocks(packages);
      setUnassignedStock(detail.unassigned ?? null);

      const scoped =
        resolvedPackageId && resolvedPackageId === packageId
          ? scopedForRequest
          : resolvedPackageId
            ? await getStock(product._id, resolvedPackageId)
            : null;

      setStock(
        scoped ?? {
          available: detail.available,
          reserved: detail.reserved,
          sold: detail.sold,
        },
      );
    },
    [],
  );

  const selectProduct = useCallback(async (p: AdminProduct) => {
    const requestId = ++selectRequestRef.current;
    setSelected(p);
    setSelectedPackageId(null);
    setInventoryStatusFilter("available");
    setStock(null);
    setPackageStocks([]);
    setUnassignedStock(null);
    setShowUnassignedCodes(false);
    setValues("");
    setCost("");
    setError(null);
    hideAdminToast();
    setStockLoading(true);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      if (selectRequestRef.current !== requestId) return;
      await loadStockForSelection(p, null);
    } catch {
      if (selectRequestRef.current !== requestId) return;
      setStock(null);
      setError("Could not load stock for this product.");
    } finally {
      if (selectRequestRef.current === requestId) setStockLoading(false);
    }
  }, [loadStockForSelection]);

  function revealUnassignedCodes() {
    setShowUnassignedCodes(true);
    setInventoryStatusFilter("available");
    setInventoryRefreshKey((key) => key + 1);
    requestAnimationFrame(() => {
      inventoryCodesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function selectPackage(packageId: string) {
    if (!selected) return;
    if (packageId === selectedPackageId) {
      setShowUnassignedCodes(false);
      return;
    }
    setShowUnassignedCodes(false);
    setSelectedPackageId(packageId);
    setInventoryStatusFilter("available");
    setValues("");
    setCost("");
    setStockLoading(true);
    setInventoryRefreshKey((k) => k + 1);
    try {
      const [detail, scoped] = await Promise.all([
        getStock(selected._id),
        getStock(selected._id, packageId),
      ]);
      setPackageStocks(detail.packages ?? []);
      setUnassignedStock(detail.unassigned ?? null);
      setStock(scoped);
    } catch {
      setError("Could not load stock for this package.");
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => {
    if (loading || !urlProductId || products.length === 0) return;
    if (autoSelectRef.current === urlProductId) return;
    const match = products.find((p) => p._id === urlProductId);
    if (!match) return;
    autoSelectRef.current = urlProductId;
    void selectProduct(match);
  }, [loading, urlProductId, products, selectProduct]);

  async function purgeUnassignedCodes() {
    if (!selected) return;
    const count = unassignedStock?.available ?? 0;
    if (count <= 0) return;
    if (
      !window.confirm(
        `Delete ${count} old code${count === 1 ? "" : "s"} that were added without a package?`,
      )
    ) {
      return;
    }
    setPurgingUnassigned(true);
    try {
      const res = await deleteUnassignedInventoryCodes(selected._id);
      adminToast(
        `Deleted ${res.deleted} old code${res.deleted === 1 ? "" : "s"}.`,
        true,
      );
      await loadStockForSelection(selected, selectedPackageId);
      setInventoryRefreshKey((k) => k + 1);
      await loadProducts({ silent: true });
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not delete old codes.",
        false,
      );
    } finally {
      setPurgingUnassigned(false);
    }
  }

  async function refreshSelectedStock() {
    if (!selected) return;
    try {
      await loadStockForSelection(selected, selectedPackageId);
      setInventoryRefreshKey((k) => k + 1);
      await loadProducts({ silent: true });
    } catch {
      adminToast("Could not refresh stock counts.", false);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selectedPackages.length > 0 && !selectedPackageId) {
      adminToast("Select a package before adding inventory.", false);
      return;
    }
    const list = parseDeliverables(values);
    if (list.length === 0) {
      adminToast("Add at least one deliverable value.", false);
      return;
    }
    setSaving(true);
    setError(null);
    hideAdminToast();
    try {
      const res = await addInventory(
        selected._id,
        list,
        cost.trim() ? Number(cost.trim()) : undefined,
        selectedPackageId ?? undefined,
      );
      if (res.added === 0 && res.skipped > 0) {
        const sample = res.duplicates.slice(0, 2).join(", ");
        const suffix =
          res.duplicates.length > 2
            ? ` (+${res.duplicates.length - 2} more)`
            : "";
        adminToast(
          `All ${res.skipped} code${res.skipped === 1 ? "" : "s"} already exist in this product inventory${sample ? `: ${sample}${suffix}` : ""}.`,
          false,
        );
      } else {
        let message = `Added ${res.added} unit${res.added === 1 ? "" : "s"}. Available: ${res.available}.`;
        if (res.skipped > 0) {
          message += ` Skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}.`;
        }
        adminToast(message, true);
        setValues("");
        setCost("");
      }
      await loadStockForSelection(selected, selectedPackageId);
      setInventoryRefreshKey((k) => k + 1);
      await loadProducts({ silent: true });
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not add inventory",
        false,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageLayout
      section="Catalog"
      title="Stock management"
      icon={BoxIcon}
      backHref="/admin/products"
      backLabel="Products"
      action={
        selected ? (
          <button
            type="button"
            onClick={clearSelection}
            className="dashboard-pro-btn-ghost"
          >
            Clear selection
          </button>
        ) : null
      }
    >
      {error ? (
        <div className="mb-5 flex flex-col items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="space-y-5">
        <section
          className="customer-dashboard-overview-section admin-stock-overview"
          aria-label="Stock overview"
        >
          <dl className="customer-dashboard-overview-stats">
            <div className={inventoryOverviewStatClass("brand")}>
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
                <dt className="customer-dashboard-overview-stat-label">
                  Products
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {displayStats.total}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {filtersActive
                    ? `${stats.total} matching filters`
                    : "Auto-delivery products only"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setStockFilter(stockFilter === "in_stock" ? "" : "in_stock")
              }
              className={inventoryOverviewStatClass(
                "success",
                stockFilter === "in_stock",
              )}
            >
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
                <dt className="customer-dashboard-overview-stat-label">
                  In stock
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {displayStats.inStock}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Ready to sell
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStockFilter(stockFilter === "low" ? "" : "low")}
              className={inventoryOverviewStatClass(
                "amber",
                stockFilter === "low",
              )}
            >
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <PulseIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  Low stock
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {displayStats.lowStock}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Under 5 units
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStockFilter(stockFilter === "out" ? "" : "out")}
              className={inventoryOverviewStatClass(
                "amber",
                stockFilter === "out",
              )}
            >
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <CloseIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  Out of stock
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {displayStats.outOfStock}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Needs replenishment
                </p>
              </div>
            </button>
          </dl>
        </section>

        <AdminOrderListCard
          icon={<BoxIcon className="h-4 w-4" />}
          title="Product inventory"
          subtitle={
            loading
              ? "Loading products…"
              : `${filteredProducts.length} of ${autoDeliveryProducts.length} auto-delivery products shown`
          }
          className="admin-stock-catalog"
        >
          <div className="admin-products-filters-list">
            <div className="admin-products-filters-row admin-stock-filters-row">
              <div className="admin-products-filter-field min-w-0">
                <label htmlFor="stock-search" className="admin-products-filter-label">
                  <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                  Search products
                </label>
                <input
                  id="stock-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title, SKU, or slug…"
                  className="admin-input w-full"
                />
              </div>
              <div className="admin-products-filter-field min-w-0">
                <label htmlFor="stock-filter" className="admin-products-filter-label">
                  Stock level
                </label>
                <select
                  id="stock-filter"
                  value={stockFilter}
                  onChange={(e) =>
                    setStockFilter(e.target.value as StockFilter)
                  }
                  className="admin-select w-full"
                >
                  <option value="">All products</option>
                  <option value="in_stock">In stock</option>
                  <option value="low">Low stock (&lt; 5)</option>
                  <option value="out">Out of stock</option>
                </select>
              </div>
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="dashboard-pro-btn-ghost mt-3 text-xs"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="admin-products-table-empty">Loading product inventory…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="dashboard-pro-empty px-4 py-8">
              <span className="dashboard-pro-empty-icon" aria-hidden>
                <BoxIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {filtersActive
                  ? "No products match your filters"
                  : isOnboarding
                    ? "No inventory yet"
                    : "No products match your filters"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                {filtersActive
                  ? "Try a different search term or stock filter."
                  : "Create a product first, then return here to upload license keys and deliverables."}
              </p>
              {isOnboarding ? (
                <Link href="/admin/products/new" className="btn-primary mt-4">
                  + Add product
                </Link>
              ) : filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="dashboard-pro-btn-ghost mt-4 text-xs"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="admin-stock-mobile-list grid gap-2 md:hidden">
                {filteredProducts.map((p) => {
                  const available = getAdminProductAvailableStock(p);
                  const status = (p.status ?? "draft") as ProductStatusValue;
                  const thumb = productThumb(p);
                  const isSelected = selected?._id === p._id;
                  const level = stockLevelBadge(available, status);

                  return (
                    <button
                      key={p._id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => void selectProduct(p)}
                      className={`admin-stock-mobile-card${
                        isSelected ? " admin-stock-mobile-card--selected" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-black/25">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BoxIcon className="h-4 w-4 text-foreground-muted" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {p.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-subtle">
                            /{p.slug}
                            {p.sku ? ` · ${p.sku}` : ""}
                          </span>
                        </span>
                        <span
                          className={
                            isSelected
                              ? "admin-stock-action admin-stock-action--active"
                              : "admin-stock-action"
                          }
                        >
                          {isSelected ? "Managing" : "Manage"}
                        </span>
                      </span>

                      <span className="mt-3 grid grid-cols-2 gap-2 text-left">
                        <span className="admin-stock-mobile-meta">
                          <span className="admin-stock-mobile-meta-label">Type</span>
                          <span className="truncate text-xs text-foreground">
                            {TYPE_LABEL[p.type] ?? p.type}
                          </span>
                        </span>
                        <span className="admin-stock-mobile-meta">
                          <span className="admin-stock-mobile-meta-label">Available</span>
                          <span className={stockTone(available, status)}>
                            {available}
                          </span>
                        </span>
                        <span className="admin-stock-mobile-meta">
                          <span className="admin-stock-mobile-meta-label">Status</span>
                          <span className={STATUS_STYLE[status] ?? STATUS_STYLE.draft}>
                            {formatStatus(status)}
                          </span>
                        </span>
                        <span className="admin-stock-mobile-meta">
                          <span className="admin-stock-mobile-meta-label">Level</span>
                          <span className={level.className}>{level.label}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="admin-products-table-wrap panel-3d-table-wrap hidden overflow-x-auto md:block">
              <table className="panel-3d-table admin-table--stock w-full text-sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Level</th>
                    <th>Available</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const available = getAdminProductAvailableStock(p);
                    const status = (p.status ?? "draft") as ProductStatusValue;
                    const thumb = productThumb(p);
                    const isSelected = selected?._id === p._id;
                    const level = stockLevelBadge(available, status);

                    return (
                      <tr
                        key={p._id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`Manage stock for ${p.title}`}
                        onClick={() => void selectProduct(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void selectProduct(p);
                          }
                        }}
                        className={`admin-stock-row cursor-pointer text-foreground-muted transition ${
                          isSelected ? "admin-stock-row--selected bg-brand/5" : ""
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-black/25">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full place-items-center text-foreground-muted">
                                  <BoxIcon className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {p.title}
                              </p>
                              <p className="truncate text-xs text-subtle">
                                /{p.slug}
                                {p.sku ? ` · ${p.sku}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs">
                            {TYPE_LABEL[p.type] ?? p.type}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              STATUS_STYLE[status] ?? STATUS_STYLE.draft
                            }
                          >
                            {formatStatus(status)}
                          </span>
                        </td>
                        <td>
                          <span className={level.className}>{level.label}</span>
                        </td>
                        <td className={stockTone(available, status)}>
                          <span className="font-semibold tabular-nums">
                            {available}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void selectProduct(p);
                            }}
                            className={
                              isSelected
                                ? "admin-stock-action admin-stock-action--active"
                                : "admin-stock-action"
                            }
                          >
                            {isSelected ? "Managing" : "Manage"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </AdminOrderListCard>

        <div ref={detailRef} className="admin-stock-detail w-full">
          {!selected ? (
            <ProductFormOrderCard
              icon={<BoxIcon className="h-4 w-4" />}
              title="Select a product"
              subtitle="Choose a catalog item from the table above to review stock levels, edit license codes, and upload new deliverables."
            >
              <ol className="admin-stock-guide space-y-3 text-sm text-foreground-muted">
                <li className="admin-stock-guide-item">
                  <span className="admin-stock-step-num">1</span>
                  <span>Pick a product from the inventory table</span>
                </li>
                <li className="admin-stock-guide-item">
                  <span className="admin-stock-step-num">2</span>
                  <span>Review available, reserved, and sold counts</span>
                </li>
                <li className="admin-stock-guide-item">
                  <span className="admin-stock-step-num">3</span>
                  <span>Add or edit codes, then save to inventory</span>
                </li>
              </ol>
            </ProductFormOrderCard>
          ) : (
            <ProductFormOrderCard
              icon={<BoxIcon className="h-4 w-4" />}
              title={selected.title}
              subtitle={formatProductTypeDelivery(selected)}
              className="overflow-hidden"
              action={
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/admin/products/${selected._id}/edit`}
                    className="dashboard-pro-btn-ghost text-xs"
                  >
                    Edit product
                  </Link>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="dashboard-pro-btn-ghost text-xs"
                  >
                    Close
                  </button>
                </div>
              }
            >
              <dl>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Product</dt>
                <dd className="admin-product-form-sidebar-fields space-y-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-black/25">
                      {selectedThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedThumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-brand">
                          <BoxIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            STATUS_STYLE[
                              (selected.status ?? "draft") as string
                            ] ?? STATUS_STYLE.draft
                          }
                        >
                          {formatStatus(selected.status ?? "draft")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-subtle">
                        /{selected.slug}
                        {selected.sku ? ` · SKU ${selected.sku}` : ""}
                      </p>
                    </div>
                  </div>

                  {unassignedStock && unassignedStock.available > 0 ? (
                    <div className="flex flex-col items-stretch gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">
                          {unassignedStock.available} old code
                          {unassignedStock.available === 1 ? "" : "s"}
                        </span>{" "}
                        were added without selecting a package. They do not
                        appear in any package tab.
                      </p>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={revealUnassignedCodes}
                          disabled={stockLoading}
                          className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                        >
                          {showUnassignedCodes ? "Showing below" : "Show old code"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void purgeUnassignedCodes()}
                          disabled={purgingUnassigned || stockLoading}
                          className="dashboard-pro-btn-ghost text-xs text-danger disabled:opacity-50"
                        >
                          {purgingUnassigned ? "Deleting…" : "Delete old codes"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {stockedPackageTabs.length > 0 ? (
                    <div className="mt-5">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                        Select package
                      </p>
                      <div className="admin-stock-package-grid">
                        {stockedPackageTabs.map((pkg) => {
                          const pkgStock =
                            packageStocks.find(
                              (row) => row.valueId === pkg.valueId,
                            ) ?? null;
                          const codeCount = pkgStock?.available ?? 0;
                          const soldCount = pkgStock?.sold ?? 0;
                          const isActive = selectedPackageId === pkg.valueId;
                          return (
                            <button
                              key={pkg.valueId}
                              type="button"
                              onClick={() => void selectPackage(pkg.valueId)}
                              className={`admin-stock-package-tab${
                                isActive
                                  ? " admin-stock-package-tab--active"
                                  : ""
                              }`}
                            >
                              <span className="admin-stock-package-tab-name">
                                {pkg.name}
                              </span>
                              <span
                                className={`admin-stock-package-tab-count${
                                  codeCount > 0
                                    ? " admin-stock-package-tab-count--in"
                                    : ""
                                }`}
                              >
                                {codeCount} available
                              </span>
                              {soldCount > 0 ? (
                                <span className="admin-stock-package-tab-sold">
                                  {soldCount} sold
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : selectedPackages.length > 0 ? (
                    <p className="mt-5 text-xs text-subtle">
                      No package has stock yet. Choose a package below to add
                      the first codes.
                    </p>
                  ) : null}

                  {activePackage ? (
                    <p className="mt-4 text-xs text-subtle">
                      Selected:{" "}
                      <span className="font-medium text-foreground">
                        {activePackage.name}
                      </span>
                      <span className="mx-1.5 text-border">·</span>
                      <span className="font-medium text-brand">
                        {stock?.available ?? 0} code
                        {(stock?.available ?? 0) === 1 ? "" : "s"}
                      </span>
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 min-[380px]:gap-3">
                    {(
                      [
                        [
                          requiresPackageSelection ? "Package codes" : "Available",
                          stock?.available ?? 0,
                          "available",
                        ],
                        ["Reserved", stock?.reserved ?? 0, "reserved"],
                        ["Sold", stock?.sold ?? 0, "sold"],
                      ] as const
                    ).map(([label, value, key]) => {
                      const isActive = inventoryStatusFilter === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => focusInventoryView(key)}
                          className={`admin-stock-kpi admin-stock-kpi--clickable text-left${
                            key === "reserved"
                              ? " admin-stock-kpi--reserved"
                              : ""
                          }${
                            key === "sold" ? " admin-stock-kpi--sold" : ""
                          }${isActive ? " admin-stock-kpi--active" : ""}`}
                        >
                          <p
                            className={`admin-stock-kpi-value ${
                              key === "available"
                                ? stockTone(
                                    value,
                                    (selected.status ?? "draft") as string,
                                  )
                                : key === "sold" && value > 0
                                  ? "text-amber-200/95"
                                  : ""
                            }`}
                          >
                            {stockLoading ? "…" : value}
                          </p>
                          <p className="admin-stock-kpi-label">{label}</p>
                          {key === "sold" && value > 0 ? (
                            <p className="admin-stock-kpi-hint">View sold codes</p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </dd>
              </div>

              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Inventory</dt>
                <dd className="admin-product-form-sidebar-fields">

                  <div className="admin-stock-detail-body grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border/60">
                  <section className="admin-stock-panel p-0 lg:pr-5">
                    <div className="admin-stock-panel-head">
                      <h3 className="text-sm font-semibold text-foreground">
                        Add inventory
                      </h3>
                      <p className="mt-0.5 text-xs text-subtle">
                        {activePackage && "name" in activePackage
                          ? `Adding codes for ${activePackage.name}`
                          : "Paste license keys or deliverables — one per line"}
                      </p>
                    </div>
                    <form onSubmit={onAdd} className="mt-4 space-y-4">
                      {requiresPackageSelection ? (
                        <div>
                          <label className={labelCls} htmlFor="stock-package">
                            Package
                          </label>
                          <select
                            id="stock-package"
                            value={selectedPackageId ?? ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (next) void selectPackage(next);
                            }}
                            disabled={stockLoading || saving}
                            className="admin-select w-full"
                          >
                            <option value="" disabled>
                              Select package…
                            </option>
                            {stockedPackageTabs.length > 0 ? (
                              <optgroup label="Packages with stock">
                                {stockedPackageTabs.map((pkg) => (
                                  <option key={pkg.valueId} value={pkg.valueId}>
                                    {pkg.name}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                            {emptyPackageOptions.length > 0 ? (
                              <optgroup label="Add stock to new package">
                                {emptyPackageOptions.map((pkg) => (
                                  <option key={pkg.valueId} value={pkg.valueId}>
                                    {pkg.name} (no stock yet)
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                          </select>
                        </div>
                      ) : null}
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className={labelCls} htmlFor="stock-values">
                            Deliverables
                          </label>
                          {deliverableCount > 0 ? (
                            <span className="text-xs font-medium text-brand">
                              {deliverableCount} ready
                            </span>
                          ) : null}
                        </div>
                        <textarea
                          id="stock-values"
                          rows={6}
                          value={values}
                          onChange={(e) => setValues(e.target.value)}
                          placeholder={"KEY-AAAA-BBBB\nKEY-CCCC-DDDD"}
                          className={`${inputCls} font-mono text-sm`}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="stock-cost">
                          Cost per unit (optional)
                        </label>
                        <input
                          id="stock-cost"
                          type="number"
                          step="0.01"
                          min="0"
                          value={cost}
                          onChange={(e) => setCost(e.target.value)}
                          placeholder="0.00"
                          className={inputCls}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={
                          saving ||
                          stockLoading ||
                          !packageSelectionReady
                        }
                        className="btn-primary w-full disabled:opacity-50"
                      >
                        {saving ? "Adding…" : "Add to inventory"}
                      </button>
                    </form>
                  </section>

                  <section
                    ref={inventoryCodesRef}
                    className="admin-stock-panel admin-stock-panel--codes p-0 lg:pl-5"
                  >
                    <div className="admin-stock-panel-head">
                      <h3 className="text-sm font-semibold text-foreground">
                        Inventory codes
                      </h3>
                      <p className="mt-0.5 text-xs text-subtle">
                        {showUnassignedCodes
                          ? "Old codes that are not in any package. Copy the value, then add it to the right package."
                          : activePackage && "name" in activePackage
                            ? inventoryStatusFilter === "sold"
                              ? `Sold codes for ${activePackage.name}`
                              : inventoryStatusFilter === "reserved"
                                ? `Reserved codes for ${activePackage.name}`
                                : `Codes for ${activePackage.name} only`
                            : "View, edit, or remove deliverables"}
                      </p>
                    </div>
                    <div className="mt-4">
                      {!packageSelectionReady && !showUnassignedCodes ? (
                        <p className="ui-surface-item ui-surface-item--dashed px-3 py-4 text-xs text-subtle">
                          Select a package above to view its inventory codes.
                        </p>
                      ) : stockLoading ? (
                        <p className="text-xs text-subtle">Loading package codes…</p>
                      ) : (
                        <InventoryCodeList
                          key={`${selected._id}-${showUnassignedCodes ? UNASSIGNED_INVENTORY_SCOPE : selectedPackageId}-${inventoryRefreshKey}`}
                          productId={selected._id}
                          variationValueId={
                            showUnassignedCodes
                              ? UNASSIGNED_INVENTORY_SCOPE
                              : selectedPackageId ?? undefined
                          }
                          embedded
                          statusFilter={inventoryStatusFilter}
                          onStatusFilterChange={setInventoryStatusFilter}
                          statusCounts={
                            showUnassignedCodes
                              ? {
                                  available: unassignedStock?.available ?? 0,
                                  reserved: unassignedStock?.reserved ?? 0,
                                  sold: unassignedStock?.sold ?? 0,
                                }
                              : {
                                  available: stock?.available ?? 0,
                                  reserved: stock?.reserved ?? 0,
                                  sold: stock?.sold ?? 0,
                                }
                          }
                          packageName={
                            showUnassignedCodes
                              ? "old-codes"
                              : activePackage && "name" in activePackage
                                ? activePackage.name
                                : selected.title
                          }
                          onChanged={() => void refreshSelectedStock()}
                        />
                      )}
                    </div>
                  </section>
                  </div>
                </dd>
              </div>
              </dl>
            </ProductFormOrderCard>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
