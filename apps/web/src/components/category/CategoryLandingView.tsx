import {
  HOME_CONTAINER_CLS,
} from "@/components/home/home-container";
import { ProductCatalogGrid } from "@/components/ProductCatalogGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  categoryTrail,
  flattenCategoryTree,
  getCategories,
  getProducts,
  type Category,
} from "@/lib/api";
import { isTopUpHomeCategory } from "@/lib/homepage-sections";
import { categoryPath, productPath } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/structured-data";
import { getCachedSeoConfig } from "@/lib/server-cache";

export const CATEGORY_PAGE_REVALIDATE = 300;

type Props = {
  category: Category;
};

export async function CategoryLandingView({ category }: Props) {
  const [{ items }, categoryTree, seoConfig] = await Promise.all([
    getProducts(
      { categoryId: category._id, limit: 48, sort: "newest" },
      { cached: true, revalidate: CATEGORY_PAGE_REVALIDATE },
    ),
    getCategories({ cached: true, revalidate: CATEGORY_PAGE_REVALIDATE }),
    getCachedSeoConfig(),
  ]);

  const siteUrl = seoConfig.canonicalDomain.replace(/\/$/, "");
  const trail = categoryTrail(category, flattenCategoryTree(categoryTree));

  const schemas = [
    breadcrumbSchema(
      [
        { name: "Home", path: "/" },
        ...trail.map((c) => ({ name: c.name, path: categoryPath(c.slug) })),
      ],
      { siteUrl },
    ),
    itemListSchema(
      category.name,
      items.map((p) => ({
        name: p.title,
        path: productPath(p.slug),
        image: p.media?.[0]?.url,
      })),
      { siteUrl },
    ),
  ];

  return (
    <main className={`${HOME_CONTAINER_CLS} pt-6 pb-10 sm:pt-8`}>
      <JsonLd data={schemas} />
      <h1 className="sr-only">{category.name}</h1>

      {items.length === 0 ? (
        <div className="card-premium border-dashed p-12 text-center text-foreground-muted">
          No products in this category yet.
        </div>
      ) : (
        <section className="home-product-section pb-4 sm:pb-5">
          <ProductCatalogGrid
            products={items}
            topUpCategory={isTopUpHomeCategory(category)}
            emptyMessage={`No products in ${category.name} yet.`}
          />
        </section>
      )}
    </main>
  );
}
