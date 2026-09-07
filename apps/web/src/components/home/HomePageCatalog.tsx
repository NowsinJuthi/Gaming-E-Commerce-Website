import { preload } from "react-dom";
import {
  HOME_SURFACE_CLS,
} from "@/components/home/home-container";
import { HomeProductSection } from "@/components/home/HomeProductSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCachedHomeCategoryProductSections } from "@/lib/server-cache";
import {
  flattenHomeCategoryProducts,
} from "@/lib/homepage-sections";
import { categoryPath, productPath } from "@/lib/seo";
import { itemListSchema } from "@/lib/structured-data";
import { resolveMediaSrc } from "@/lib/site-appearance";

export async function HomePageCatalog() {
  const categorySections = await getCachedHomeCategoryProductSections();
  const catalogProducts = flattenHomeCategoryProducts(categorySections);
  const firstProductImage = categorySections[0]?.products[0]?.media?.[0]?.url?.trim();

  if (firstProductImage) {
    preload(resolveMediaSrc(firstProductImage), {
      as: "image",
      fetchPriority: "high",
    });
  }

  if (categorySections.length === 0) {
    return (
      <div className={`${HOME_SURFACE_CLS} px-6 py-16 text-center`}>
        <p className="text-lg font-semibold text-foreground">No products yet</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Add products from the admin panel — they will appear here by category.
        </p>
      </div>
    );
  }

  return (
    <>
      {catalogProducts.length > 0 ? (
        <JsonLd
          data={itemListSchema(
            "Featured Products",
            catalogProducts.map((p) => ({
              name: p.title,
              path: productPath(p.slug),
              image: p.media?.[0]?.url,
            })),
          )}
        />
      ) : null}
      <div className="space-y-1">
        {categorySections.map(({ category, products, topUpCategory }, index) => (
          <HomeProductSection
            key={category._id}
            title={category.name}
            viewAllHref={categoryPath(category.slug)}
            products={products}
            topUpCategory={topUpCategory}
            prioritizeFirstImage={index === 0}
          />
        ))}
      </div>
    </>
  );
}
