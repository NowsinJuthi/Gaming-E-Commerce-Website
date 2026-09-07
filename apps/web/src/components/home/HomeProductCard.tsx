import { ProductCard } from "@/components/ProductCard";
import type { ProductListItem } from "@/lib/api";

type HomeProductCardProps = {
  product: ProductListItem;
  topUpCategory?: boolean;
  imagePriority?: boolean;
};

export function HomeProductCard({
  product,
  topUpCategory,
  imagePriority,
}: HomeProductCardProps) {
  return (
    <ProductCard
      product={product}
      topUpCategory={topUpCategory}
      imagePriority={imagePriority}
    />
  );
}
