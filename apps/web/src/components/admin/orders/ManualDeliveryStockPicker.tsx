"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { BoxIcon, ChevronIcon, SearchIcon } from "@/components/admin/icons";
import { adminToast } from "@/lib/admin-toast";
import {
  normalizeOrderLineProductId,
  parseOrderItemPackage,
  resolveGiftCardAmountForOrderItem,
} from "@/lib/admin-order-view";
import {
  applyManualStockOrderFlags,
  buildManualStockCatalog,
  countHiddenManualStockProducts,
  filterManualStockPackages,
  filterManualStockProducts,
  formatInventoryPackageAmount,
  resolveGiftCardAmountDisplay,
  UNASSIGNED_INVENTORY_SCOPE,
  type ManualStockCatalogPackage,
  type ManualStockCatalogProduct,
} from "@/lib/inventory-packages";
import {
  adminListProducts,
  getStock,
  listInventoryCodes,
  type AdminProduct,
  type InventoryCodeItem,
  type OrderLine,
} from "@/lib/api";

type Props = {
  orderItems: OrderLine[];
  usedInventoryIds: Set<string>;
  targetFieldId: string | null;
  disabled?: boolean;
  onPick: (pick: {
    code: string;
    amount?: string;
    inventoryItemId: string;
  }) => void;
};

type PickerStep = "products" | "packages" | "codes";

function productThumb(product: AdminProduct) {
  return product.media?.find((media) => media.url)?.url ?? "";
}

async function fetchAllAvailableCodes(
  productId: string,
  variationValueId?: string,
): Promise<{ items: InventoryCodeItem[]; total: number }> {
  const limit = 100;
  const baseParams = {
    status: "available" as const,
    limit,
  };

  async function loadAll(
    scopedVariationId?: string,
  ): Promise<{ items: InventoryCodeItem[]; total: number }> {
    let page = 1;
    let total = 0;
    const items: InventoryCodeItem[] = [];

    while (page === 1 || items.length < total) {
      const data = await listInventoryCodes(productId, {
        ...baseParams,
        page,
        ...(scopedVariationId
          ? { variationValueId: scopedVariationId }
          : {}),
      });
      total = data.total;
      items.push(...data.items);
      if (data.items.length === 0) break;
      page += 1;
    }

    return { items, total };
  }

  if (!variationValueId) {
    return loadAll();
  }

  const scoped = await loadAll(variationValueId);
  if (scoped.total > 0) return scoped;

  const unassigned = await loadAll(UNASSIGNED_INVENTORY_SCOPE);
  return unassigned;
}

export function ManualDeliveryStockPicker({
  orderItems,
  usedInventoryIds,
  targetFieldId,
  disabled = false,
  onPick,
}: Props) {
  const panelId = useId();
  const searchInputId = useId();
  const [expanded, setExpanded] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [step, setStep] = useState<PickerStep>("products");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ManualStockCatalogProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );

  const [items, setItems] = useState<InventoryCodeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const orderLineKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of orderItems) {
      const productId = normalizeOrderLineProductId(item.productId);
      const variationId = item.variationValueId?.trim() ?? "";
      keys.add(`${productId}::${variationId}`);
    }
    return keys;
  }, [orderItems]);

  const displayCatalog = useMemo(
    () => applyManualStockOrderFlags(catalog, orderLineKeys),
    [catalog, orderLineKeys],
  );

  const activeSearch =
    step === "products"
      ? productSearch
      : step === "packages"
        ? packageSearch
        : codeSearch;

  const setActiveSearch = useCallback(
    (value: string) => {
      if (step === "products") setProductSearch(value);
      else if (step === "packages") setPackageSearch(value);
      else setCodeSearch(value);
    },
    [step],
  );

  const searching = activeSearch.trim().length > 0;

  const visibleProducts = useMemo(
    () => filterManualStockProducts(displayCatalog, productSearch),
    [displayCatalog, productSearch],
  );

  const selectedProduct = useMemo(
    () =>
      displayCatalog.find((entry) => entry.productId === selectedProductId) ??
      null,
    [displayCatalog, selectedProductId],
  );

  const visiblePackages = useMemo(() => {
    if (!selectedProduct) return [];
    return filterManualStockPackages(selectedProduct.packages, packageSearch);
  }, [selectedProduct, packageSearch]);

  const selectedPackage = useMemo(() => {
    if (!selectedProduct || !selectedPackageId) return null;
    return (
      selectedProduct.packages.find((pkg) => pkg.valueId === selectedPackageId) ??
      null
    );
  }, [selectedProduct, selectedPackageId]);

  const hiddenProductCount = useMemo(
    () => countHiddenManualStockProducts(displayCatalog),
    [displayCatalog],
  );

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const products = await adminListProducts();
      const productIds = products.map((product) => product._id);
      const stockByProductId = new Map<
        string,
        Awaited<ReturnType<typeof getStock>>
      >();

      await Promise.all(
        productIds.map(async (productId) => {
          try {
            stockByProductId.set(productId, await getStock(productId));
          } catch {
            /* keep list-level counts for this product */
          }
        }),
      );

      setCatalog(
        buildManualStockCatalog(products, new Set(), stockByProductId),
      );
    } catch (err) {
      setCatalog([]);
      setCatalogError(
        err instanceof Error
          ? err.message
          : "Could not load catalog products for stock.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadCodes = useCallback(async () => {
    if (step !== "codes" || !selectedProductId) {
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAllAvailableCodes(
        selectedProductId,
        selectedPackageId ?? undefined,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      const message =
        err instanceof Error
          ? err.message
          : "Could not load stock codes for this package.";
      setLoadError(message);
      adminToast(message, false);
    } finally {
      setLoading(false);
    }
  }, [step, selectedProductId, selectedPackageId]);

  useEffect(() => {
    if (!expanded) return;
    void loadCatalog();
  }, [expanded, loadCatalog]);

  useEffect(() => {
    if (!expanded || step !== "codes" || !selectedProductId) return;
    void loadCodes();
  }, [expanded, step, selectedProductId, selectedPackageId, loadCodes]);

  function resetNavigation() {
    setStep("products");
    setSelectedProductId(null);
    setSelectedPackageId(null);
    setProductSearch("");
    setPackageSearch("");
    setCodeSearch("");
    setItems([]);
    setTotal(0);
    setLoadError(null);
  }

  function selectProduct(entry: ManualStockCatalogProduct) {
    setSelectedProductId(entry.productId);
    setSelectedPackageId(null);
    setPackageSearch("");
    setCodeSearch("");
    setItems([]);
    setTotal(0);
    setLoadError(null);

    if (entry.packages.length === 0) {
      setStep("codes");
      return;
    }

    setStep("packages");
  }

  function selectPackage(pkg: ManualStockCatalogPackage) {
    setSelectedPackageId(pkg.valueId);
    setCodeSearch("");
    setStep("codes");
  }

  function goBack() {
    if (step === "codes") {
      if (selectedProduct?.packages.length === 0) {
        resetNavigation();
        return;
      }
      setStep("packages");
      setSelectedPackageId(null);
      setCodeSearch("");
      setItems([]);
      setTotal(0);
      setLoadError(null);
      return;
    }

    if (step === "packages") {
      setStep("products");
      setSelectedProductId(null);
      setSelectedPackageId(null);
      setPackageSearch("");
      setCodeSearch("");
      setItems([]);
      setTotal(0);
      setLoadError(null);
    }
  }

  function resolvePickAmount(): string | undefined {
    if (selectedPackage?.name.trim()) {
      const fromPackage = resolveGiftCardAmountDisplay(selectedPackage.name);
      if (fromPackage) return fromPackage;
    }

    if (!selectedProduct) return undefined;

    const productAttributes = {
      [selectedProduct.productId]: selectedProduct.product.attributes,
    };

    const matchingLines = orderItems.filter(
      (line) =>
        normalizeOrderLineProductId(line.productId) === selectedProduct.productId,
    );

    for (const line of matchingLines) {
      if (
        selectedPackage?.valueId &&
        line.variationValueId &&
        line.variationValueId !== selectedPackage.valueId
      ) {
        continue;
      }
      const amount = resolveGiftCardAmountForOrderItem(line, productAttributes);
      if (amount) return amount;
    }

    for (const line of matchingLines) {
      const { packageName } = parseOrderItemPackage(line.title);
      if (!packageName?.trim()) continue;
      const amount = resolveGiftCardAmountDisplay(packageName);
      if (amount) return amount;
    }

    if (selectedPackage?.name.trim()) {
      return resolveGiftCardAmountDisplay(selectedPackage.name) || undefined;
    }

    return undefined;
  }

  function handlePick(item: InventoryCodeItem) {
    if (!targetFieldId) {
      adminToast("Select a delivery field first, then add stock codes.", false);
      return;
    }
    if (usedInventoryIds.has(item.id)) {
      adminToast("This code is already added to the delivery.", false);
      return;
    }

    onPick({
      code: item.value,
      amount: resolvePickAmount(),
      inventoryItemId: item.id,
    });
    adminToast("Stock code added to delivery.", true);
  }

  const countLabel = useMemo(() => {
    if (!expanded) return null;
    if (step === "products") {
      if (catalogLoading && catalog.length === 0) return "Loading…";
      return `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"}`;
    }
    if (step === "packages" && selectedProduct) {
      return `${visiblePackages.length} package${visiblePackages.length === 1 ? "" : "s"}`;
    }
    if (step === "codes") {
      return loading && items.length === 0
        ? "Loading…"
        : `${total} available`;
    }
    return null;
  }, [
    expanded,
    step,
    catalogLoading,
    catalog.length,
    visibleProducts.length,
    visiblePackages.length,
    selectedProduct,
    loading,
    items.length,
    total,
  ]);

  const searchPlaceholder =
    step === "products"
      ? "Search product…"
      : step === "packages"
        ? "Search package…"
        : "Search code…";

  const filteredCodes = useMemo(() => {
    const q = codeSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.value.toLowerCase().includes(q));
  }, [items, codeSearch]);

  const showInitialCatalogLoading = catalogLoading && catalog.length === 0;

  const searchHint = useMemo(() => {
    if (step === "products") {
      if (showInitialCatalogLoading) return "Loading products…";
      if (productSearch.trim()) {
        return `${visibleProducts.length} match${visibleProducts.length === 1 ? "" : "es"} with available stock`;
      }
      return `${visibleProducts.length} with stock${
        hiddenProductCount > 0
          ? ` · ${hiddenProductCount} without codes hidden`
          : ""
      }`;
    }
    if (step === "packages") {
      if (packageSearch.trim()) {
        return `${visiblePackages.length} match${visiblePackages.length === 1 ? "" : "es"} with available stock`;
      }
      return `${visiblePackages.length} package${visiblePackages.length === 1 ? "" : "s"} with stock`;
    }
    if (step === "codes") {
      if (loading && items.length === 0) return "Loading codes…";
      if (codeSearch.trim()) {
        return `${filteredCodes.length} of ${total} code${total === 1 ? "" : "s"} match your search`;
      }
      return `${total} available code${total === 1 ? "" : "s"}`;
    }
    return "";
  }, [
    step,
    showInitialCatalogLoading,
    productSearch,
    visibleProducts.length,
    hiddenProductCount,
    packageSearch,
    visiblePackages.length,
    loading,
    items.length,
    codeSearch,
    filteredCodes.length,
    total,
  ]);

  return (
    <div className="admin-order-manual-stock admin-template-card">
      <button
        type="button"
        className="admin-template-collapse-trigger admin-template-collapse-trigger--top w-full"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() =>
          setExpanded((open) => {
            if (open) resetNavigation();
            return !open;
          })
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <BoxIcon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
          <span className="truncate admin-template-collapse-title admin-template-collapse-title--named">
            Stock management
          </span>
          {countLabel ? (
            <span className="shrink-0 text-[10px] font-normal text-subtle">
              · {countLabel}
            </span>
          ) : null}
        </span>
        <span className="admin-template-collapse-chevron-wrap" aria-hidden>
          <ChevronIcon
            className={`admin-template-collapse-chevron${expanded ? " admin-template-collapse-chevron--open" : ""}`}
          />
        </span>
      </button>

      {expanded ? (
        <div id={panelId} className="admin-template-collapse-panel space-y-3">
          <p className="admin-order-view-detail-help admin-order-manual-stock-pad hidden pt-1 sm:block">
            Pick a product, then a package, then add codes to manual delivery.
            Only auto-delivery products with stock are listed by default.
          </p>

          {step !== "products" && selectedProduct ? (
            <div className="admin-order-manual-stock-pad flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={goBack}
                className="dashboard-pro-btn-ghost shrink-0 px-2 py-1 text-[10px]"
              >
                ← Back
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-black/25">
                  {productThumb(selectedProduct.product) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productThumb(selectedProduct.product)}
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
                  <p className="truncate text-xs font-semibold text-foreground">
                    {selectedProduct.product.title}
                  </p>
                  {step === "codes" && selectedPackage ? (
                    <p className="truncate text-[10px] text-subtle">
                      {selectedPackage.name}
                    </p>
                  ) : (
                    <p className="truncate text-[10px] text-subtle">
                      {selectedProduct.totalAvailable} codes total
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="admin-order-manual-stock-pad">
            <label htmlFor={searchInputId} className="sr-only">
              {searchPlaceholder}
            </label>
            <div className="admin-input-icon-wrap">
              <SearchIcon className="admin-input-icon" aria-hidden />
              <input
                id={searchInputId}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder={searchPlaceholder}
                disabled={disabled}
                className="admin-input admin-order-manual-stock-search w-full text-sm"
              />
            </div>
            <p
              className="admin-order-manual-stock-search-hint mt-1.5 text-[10px] leading-snug text-subtle"
              aria-live="polite"
            >
              {searchHint}
            </p>
          </div>

          {catalogError ? (
            <p className="admin-order-manual-stock-pad text-xs text-rose-300">{catalogError}</p>
          ) : showInitialCatalogLoading ? (
            <p className="admin-order-manual-stock-pad text-xs text-subtle">Loading catalog stock…</p>
          ) : step === "products" ? (
            displayCatalog.length === 0 ? (
              <p className="admin-order-manual-stock-pad text-xs text-subtle">
                No inventory products found. Add auto-delivery products under{" "}
                <Link
                  href="/admin/products/stock"
                  className="text-brand hover:underline"
                >
                  Products → Stock management
                </Link>
                .
              </p>
            ) : visibleProducts.length === 0 ? (
              <p className="admin-order-manual-stock-pad text-xs text-subtle">
                No products match your search
                {searching ? "." : " with available stock."}
              </p>
            ) : (
              <ul className="admin-order-manual-stock-pad max-h-52 space-y-1.5 overflow-y-auto">
                {visibleProducts.map((entry) => {
                  const thumb = productThumb(entry.product);
                  return (
                    <li key={entry.productId}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => selectProduct(entry)}
                        className="admin-order-manual-stock-product w-full text-left"
                      >
                        <span className="admin-order-manual-stock-product-thumb">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BoxIcon
                              className="h-4 w-4 text-foreground-muted"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {entry.product.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-subtle">
                            /{entry.product.slug}
                            {entry.packages.length > 0
                              ? ` · ${entry.packages.filter((pkg) => pkg.hasStock).length} packages`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={`block text-xs font-semibold tabular-nums ${
                              entry.totalAvailable > 0
                                ? "text-emerald-300"
                                : "text-subtle"
                            }`}
                          >
                            {entry.totalAvailable}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wide text-subtle">
                            codes
                          </span>
                        </span>
                        {entry.inOrder ? (
                          <span className="admin-order-manual-stock-product-badge">
                            In order
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : step === "packages" && selectedProduct ? (
            visiblePackages.length === 0 ? (
              <p className="admin-order-manual-stock-pad text-xs text-subtle">
                No packages match
                {searching ? " your search." : " with available stock."}
              </p>
            ) : (
              <div className="admin-order-manual-stock-pad">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  Select package
                </p>
                <div className="admin-order-manual-stock-package-grid grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
                  {visiblePackages.map((pkg) => (
                    <button
                      key={pkg.valueId}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectPackage(pkg)}
                      className="admin-stock-package-tab"
                    >
                      <span className="admin-stock-package-tab-name">
                        {pkg.name}
                      </span>
                      <span
                        className={`admin-stock-package-tab-count${
                          pkg.availableCount > 0
                            ? " admin-stock-package-tab-count--in"
                            : ""
                        }`}
                      >
                        {pkg.availableCount} code
                        {pkg.availableCount === 1 ? "" : "s"}
                      </span>
                      {pkg.inOrder ? (
                        <span className="mt-1 block text-[9px] uppercase tracking-wide text-brand/80">
                          In order
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : step === "codes" && selectedProduct ? (
            <div className="ui-surface-item admin-order-manual-stock-codes-panel mb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                  Available codes
                  {selectedPackage ? ` · ${selectedPackage.name}` : ""}
                </p>
                <span className="text-[10px] text-subtle">
                  {loading && items.length === 0
                    ? "Loading…"
                    : `${filteredCodes.length}${codeSearch.trim() ? ` / ${total}` : ""} shown`}
                </span>
              </div>

              {loading && items.length === 0 ? (
                <p className="text-xs text-subtle">Loading codes…</p>
              ) : loadError ? (
                <p className="text-xs text-rose-300">{loadError}</p>
              ) : filteredCodes.length === 0 ? (
                <p className="text-xs text-subtle">
                  {codeSearch.trim()
                    ? "No codes match your search."
                    : "No available codes for this package. Add stock under "}
                  {!codeSearch.trim() ? (
                    <a
                      href={`/admin/products/stock?productId=${encodeURIComponent(selectedProduct.productId)}`}
                      className="text-brand hover:underline"
                    >
                      Products → Stock management
                    </a>
                  ) : null}
                  {!codeSearch.trim() ? "." : null}
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredCodes.map((item) => {
                    const used = usedInventoryIds.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-sunken/30 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-mono text-xs text-foreground">
                            {item.value}
                          </p>
                          {selectedPackage ? (
                            <p className="mt-0.5 text-[10px] text-subtle">
                              Amount:{" "}
                              {resolveGiftCardAmountDisplay(selectedPackage.name) ||
                                formatInventoryPackageAmount(selectedPackage.name)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={disabled || used}
                          onClick={() => handlePick(item)}
                          className="btn-primary-sm shrink-0 px-2 py-1 text-[10px] disabled:opacity-40"
                        >
                          {used ? "Added" : "Add"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
