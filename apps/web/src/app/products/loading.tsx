import {
  HOME_CONTAINER_CLS,
  PRODUCT_CATALOG_GRID_CLS,
  PRODUCT_CATALOG_GRID_ITEM_CLS,
} from "@/components/home/home-container";

function SkeletonCard() {
  return (
    <div className="product-catalog-card animate-pulse" aria-hidden>
      <div className="product-catalog-card-bg bg-elevated" />
      <div className="product-catalog-card-body">
        <div className="product-catalog-card-visual">
          <div className="product-catalog-card-img rounded-lg bg-border/40" />
        </div>
        <div className="product-catalog-divider" />
        <div className="h-4 w-3/4 rounded bg-border/40" />
        <div className="product-catalog-footer mt-2">
          <div className="h-4 w-16 rounded bg-border/40" />
          <div className="h-4 w-14 rounded bg-border/40" />
        </div>
      </div>
    </div>
  );
}

export default function ProductsLoading() {
  return (
    <div className={`${HOME_CONTAINER_CLS} pt-2 pb-10 sm:pt-4`} aria-busy="true" aria-label="Loading products">
      {/* Header row skeleton */}
      <header className="mb-2">
        <div className="h-6 w-28 animate-pulse rounded bg-border/40 md:h-7 md:w-32" />
      </header>
      {/* Product grid skeleton — 12 placeholder cards */}
      <div className={PRODUCT_CATALOG_GRID_CLS}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={PRODUCT_CATALOG_GRID_ITEM_CLS}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
