import Link from "next/link";
import {
  HOME_CATEGORY_PRODUCTS_GRID_CLS,
  HOME_CATEGORY_PRODUCTS_ITEM_CLS,
} from "@/components/home/home-container";
import { HomeProductCard } from "@/components/home/HomeProductCard";
import type { ProductListItem } from "@/lib/api";

const HOME_ROW_LIMIT = 6;

type HomeProductSectionProps = {
  title: string;
  viewAllHref: string;
  products: ProductListItem[];
  topUpCategory?: boolean;
  /** Mark the first card image as LCP-priority (homepage hero row only). */
  prioritizeFirstImage?: boolean;
};

export function HomeProductSection({
  title,
  viewAllHref,
  products,
  topUpCategory = false,
  prioritizeFirstImage = false,
}: HomeProductSectionProps) {
  const rowProducts = products.slice(0, HOME_ROW_LIMIT);

  if (rowProducts.length === 0) return null;

  return (
    <section className="home-product-section py-4 sm:py-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground md:text-xl">{title}</h2>
        <Link
          href={viewAllHref as "/products"}
          className="btn-primary btn-primary-sm"
          aria-label={`View all ${title} products`}
        >
          All
        </Link>
      </div>

      <div className={HOME_CATEGORY_PRODUCTS_GRID_CLS}>
        {rowProducts.map((product, index) => (
          <div key={product._id} className={HOME_CATEGORY_PRODUCTS_ITEM_CLS}>
            <HomeProductCard
              product={product}
              topUpCategory={topUpCategory}
              imagePriority={prioritizeFirstImage && index === 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
