"use client";

import { PriceText } from "@/components/ui/PriceText";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_CATALOG_GRID_CLS } from "@/components/home/home-container";
import { ProductCard } from "@/components/ProductCard";
import { useAutoDeliveryAccess } from "@/hooks/useAutoDeliveryAccess";
import {
  autocomplete,
  getFacets,
  searchProducts,
  type Autocomplete,
  type Facets,
  type ProductListItem,
} from "@/lib/api";
import { filterProductsForAutoDeliveryAccess } from "@/lib/product-page";
import { productPath } from "@/lib/seo";

export default function SearchPage() {
  const router = useRouter();
  const { canAccess, loaded: accessLoaded } = useAutoDeliveryAccess();

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [region, setRegion] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(false);

  const [suggest, setSuggest] = useState<Autocomplete | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const limit = 12;
  const visibleItems = useMemo(
    () =>
      accessLoaded
        ? filterProductsForAutoDeliveryAccess(items, canAccess)
        : [],
    [accessLoaded, items, canAccess],
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q") ?? "";
    const cat = sp.get("categoryId") ?? "";
    const brand = sp.get("brandId") ?? "";
    setTerm(q);
    setDebounced(q);
    if (cat) setCategoryId(cat);
    if (brand) setBrandId(brand);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const buildParams = useCallback(
    () => ({
      q: debounced || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      region: region || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    }),
    [debounced, categoryId, brandId, region, minPrice, maxPrice],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = buildParams();
    const t = setTimeout(() => {
      Promise.all([
        searchProducts({ ...params, page, limit }),
        getFacets(params),
      ])
        .then(([res, fac]) => {
          if (!active) return;
          setItems(res.items);
          setTotal(res.total);
          setFacets(fac);
        })
        .catch(() => {
          if (!active) return;
          setItems([]);
          setTotal(0);
        })
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [buildParams, page]);

  useEffect(() => {
    setPage(1);
  }, [debounced, categoryId, brandId, region, minPrice, maxPrice]);

  useEffect(() => {
    if (!showSuggest || term.trim().length < 1) {
      setSuggest(null);
      return;
    }
    const t = setTimeout(() => {
      autocomplete(term.trim()).then(setSuggest);
    }, 150);
    return () => clearTimeout(t);
  }, [term, showSuggest]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function clearFilters() {
    setCategoryId("");
    setBrandId("");
    setRegion("");
    setMinPrice("");
    setMaxPrice("");
  }

  const hasFilters =
    categoryId || brandId || region || minPrice || maxPrice;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const Filters = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-brand hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <FilterGroup title="Category">
        {facets?.categories.length ? (
          facets.categories.map((c) => (
            <FilterRow
              key={c.id}
              active={categoryId === c.id}
              label={c.name}
              count={c.count}
              onClick={() =>
                setCategoryId((cur) => (cur === c.id ? "" : c.id))
              }
            />
          ))
        ) : (
          <p className="text-xs text-foreground-muted">No categories</p>
        )}
      </FilterGroup>

      <FilterGroup title="Brand">
        {facets?.brands.length ? (
          facets.brands.map((b) => (
            <FilterRow
              key={b.id}
              active={brandId === b.id}
              label={b.name}
              count={b.count}
              onClick={() => setBrandId((cur) => (cur === b.id ? "" : b.id))}
            />
          ))
        ) : (
          <p className="text-xs text-foreground-muted">No brands</p>
        )}
      </FilterGroup>

      <FilterGroup title="Region">
        {facets?.regions.length ? (
          facets.regions.map((r) => (
            <FilterRow
              key={r.region}
              active={region === r.region}
              label={r.region}
              count={r.count}
              onClick={() =>
                setRegion((cur) => (cur === r.region ? "" : r.region))
              }
            />
          ))
        ) : (
          <p className="text-xs text-foreground-muted">No regions</p>
        )}
      </FilterGroup>

      <FilterGroup title="Price">
        {facets && (
          <p className="mb-2 text-xs text-foreground-muted">
            Range: <PriceText amount={facets.price.min} currency={"BDT"} /> –{" "}
            <PriceText amount={facets.price.max} currency={"BDT"} />
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min"
            className="panel-3d-input w-full"
          />
          <span className="text-foreground-muted">–</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max"
            className="panel-3d-input w-full"
          />
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-5 md:px-6 lg:px-8 xl:px-10">
      <h1 className="text-2xl font-bold">Search</h1>

      <div ref={boxRef} className="relative mt-4">
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setShowSuggest(true);
          }}
          onFocus={() => setShowSuggest(true)}
          placeholder="Search products, categories, brands…"
          className="panel-3d-input w-full px-4 py-3 text-sm"
        />

        {showSuggest &&
          suggest &&
          (suggest.products.length > 0 ||
            suggest.categories.length > 0 ||
            suggest.brands.length > 0) && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-elevated shadow-lg">
              {suggest.products.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-foreground-muted">
                    Products
                  </p>
                  {suggest.products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => router.push(productPath(p.slug))}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-sunken">
                        {p.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">
                        {p.title}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        <PriceText amount={p.price} currency={p.currency} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {(suggest.categories.length > 0 ||
                suggest.brands.length > 0) && (
                <div className="border-t border-border p-2">
                  {suggest.categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCategoryId(c.id);
                        setShowSuggest(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="text-foreground-muted">{c.name}</span>
                      <span className="text-xs text-subtle">Category</span>
                    </button>
                  ))}
                  {suggest.brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBrandId(b.id);
                        setShowSuggest(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="text-foreground-muted">{b.name}</span>
                      <span className="text-xs text-subtle">Brand</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      <div className="mt-6 flex items-center justify-between lg:hidden">
        <button
          onClick={() => setMobileFilters((v) => !v)}
          className="panel-3d-btn-ghost"
        >
          {mobileFilters ? "Hide filters" : "Show filters"}
        </button>
        <span className="text-sm text-subtle">{total} results</span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[200px_1fr] lg:gap-6">
        <aside
          className={`${mobileFilters ? "block" : "hidden"} lg:block`}
        >
          {Filters}
        </aside>

        <section>
          <p className="hidden text-sm text-subtle lg:block">
            {loading ? "Searching…" : `${total} result${total !== 1 ? "s" : ""}`}
          </p>

          {!loading && accessLoaded && visibleItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center text-subtle">
              No products match your search.
            </div>
          ) : (
            <div className={`mt-4 ${PRODUCT_CATALOG_GRID_CLS}`}>
              {visibleItems.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="panel-3d-btn-ghost panel-3d-btn-sm disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-subtle">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="panel-3d-btn-ghost panel-3d-btn-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition ${
        active
          ? "bg-brand/10 font-medium text-brand"
          : "text-foreground-muted hover:bg-muted"
      }`}
    >
      <span className="capitalize">{label}</span>
      <span className="text-xs text-foreground-muted">{count}</span>
    </button>
  );
}
