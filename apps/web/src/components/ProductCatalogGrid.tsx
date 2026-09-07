"use client";

import { ProductCard } from "@/components/ProductCard";
import { PRODUCT_CATALOG_GRID_CLS, PRODUCT_CATALOG_GRID_ITEM_CLS } from "@/components/home/home-container";
import { useAutoDeliveryAccess } from "@/hooks/useAutoDeliveryAccess";
import type { ProductListItem } from "@/lib/api";
import { filterProductsForAutoDeliveryAccess } from "@/lib/product-page";

type ProductCatalogGridProps = {
  products: ProductListItem[];
  topUpCategory?: boolean;
  emptyMessage?: string;
};

export function ProductCatalogGrid({
  products,
  topUpCategory = false,
  emptyMessage = "No products available yet.",
}: ProductCatalogGridProps) {
  const { canAccess, loaded } = useAutoDeliveryAccess();
  const effectiveAccess = loaded ? canAccess : false;
  const visible = filterProductsForAutoDeliveryAccess(products, effectiveAccess);

  if (visible.length === 0) {
    return (
      <div className="card-premium border-dashed p-12 text-center text-foreground-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={PRODUCT_CATALOG_GRID_CLS}>
      {visible.map((product) => (
        <div key={product._id} className={PRODUCT_CATALOG_GRID_ITEM_CLS}>
          <ProductCard
            product={product}
            topUpCategory={topUpCategory}
          />
        </div>
      ))}
    </div>
  );
}
