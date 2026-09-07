import {
  getHomepageSections,
  type Category,
  type HomepageSection,
  type ProductListItem,
} from "@/lib/api";

export type HomeCategoryProductSection = {
  category: Category;
  products: ProductListItem[];
  topUpCategory: boolean;
};

const TOPUP_CATEGORY_RE = /top[- ]?up|gaming/i;

export function isTopUpHomeCategory(category: { name: string; slug?: string }): boolean {
  const slug = category.slug?.toLowerCase() ?? "";
  const name = category.name?.toLowerCase() ?? "";
  return TOPUP_CATEGORY_RE.test(slug) || TOPUP_CATEGORY_RE.test(name);
}

/**
 * Fetches homepage sections using a SINGLE API request instead of N+1.
 * The backend endpoint returns all categories with their products in one shot.
 */
export async function getHomeCategoryProductSections(opts?: {
  limitPerCategory?: number;
  featuredOnly?: boolean;
  revalidate?: number;
}): Promise<HomeCategoryProductSection[]> {
  const revalidate = opts?.revalidate ?? 60;

  const sections = await getHomepageSections({
    limitPerCategory: opts?.limitPerCategory ?? 6,
    featuredOnly: opts?.featuredOnly,
    cached: true,
    revalidate,
  });

  return sections.map((section: HomepageSection) => ({
    category: section.category as unknown as Category,
    products: section.products,
    topUpCategory: isTopUpHomeCategory(section.category),
  }));
}

/** All homepage catalog products (deduped) for structured data. */
export function flattenHomeCategoryProducts(
  sections: HomeCategoryProductSection[],
): ProductListItem[] {
  const seen = new Set<string>();
  const out: ProductListItem[] = [];
  for (const section of sections) {
    for (const product of section.products) {
      if (seen.has(product._id)) continue;
      seen.add(product._id);
      out.push(product);
    }
  }
  return out;
}
