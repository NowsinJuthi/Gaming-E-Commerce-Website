"use client";

import { PriceText } from "@/components/ui/PriceText";
import Link from "next/link";
import { ProductMediaBackground } from "@/components/product/ProductMediaBackground";
import { WishlistIconButton } from "@/components/product/WishlistIconButton";
import { type ProductListItem } from "@/lib/api";
import { isProductInStock } from "@/lib/product-page";
import { productPath } from "@/lib/seo";
import { resolveMediaSrc } from "@/lib/site-appearance";

type ProductCardProps = {
  product: ProductListItem;
  /** Home Game Top-Up category sections — darkest card background */
  topUpCategory?: boolean;
  /** First above-the-fold catalog image (homepage LCP candidate). */
  imagePriority?: boolean;
};

export function ProductCard({
  product,
  topUpCategory = false,
  imagePriority = false,
}: ProductCardProps) {
  const image = resolveMediaSrc(product.media?.[0]?.url ?? "");
  const { basePrice, currency } = product.pricing;
  const inStock = isProductInStock(product);
  const isTopUp = product.type === "topup";

  const toneClass = topUpCategory
    ? " product-catalog-card--topup-category"
    : isTopUp
      ? " product-catalog-card--topup"
      : "";

  return (
    <Link
      href={productPath(product.slug)}
      className={`product-catalog-card group${toneClass}`}
    >
      <div className="product-catalog-card-bg">
        <ProductMediaBackground
          compact
          fill
          staticPalette
          imageUrl={image}
          showBorder={false}
        />
      </div>

      <div className="product-catalog-card-body">
        <div className="product-catalog-card-visual">
          <WishlistIconButton
            productId={product._id}
            className="product-catalog-wishlist"
          />
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.media?.[0]?.alt ?? product.title}
              width={400}
              height={400}
              className="product-catalog-card-img"
              loading={imagePriority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={imagePriority ? "high" : "auto"}
            />
          ) : (
            <div className="product-catalog-card-img-fallback">No image</div>
          )}
        </div>

        <div className="product-catalog-divider" aria-hidden />

        <h3 className="product-catalog-title">{product.title}</h3>

        <div className="product-catalog-footer">
          <span className="product-catalog-price">
            <PriceText amount={basePrice} currency={currency} />
          </span>
          <span
            className={`product-catalog-stock${inStock ? "" : " product-catalog-stock--out"}`}
          >
            {inStock ? "In stock" : "Out of stock"}
          </span>
        </div>
      </div>
    </Link>
  );
}
