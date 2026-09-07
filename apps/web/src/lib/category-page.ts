import {
  getCategoryBySlug,
  getProduct,
  type Category,
  type ProductDetail,
} from "@/lib/api";
import { isReservedSlug } from "@/lib/seo";

export type SlugPageResolution =
  | { kind: "product"; product: ProductDetail }
  | { kind: "category"; category: Category }
  | { kind: "not-found" };

export async function resolveSlugPage(
  slug: string,
  revalidate: number,
): Promise<SlugPageResolution> {
  if (isReservedSlug(slug)) {
    return { kind: "not-found" };
  }

  const product = await getProduct(slug, { cached: true, revalidate });
  if (product) {
    return { kind: "product", product };
  }

  const category = await getCategoryBySlug(slug, { cached: true, revalidate });
  if (category) {
    return { kind: "category", category };
  }

  return { kind: "not-found" };
}
