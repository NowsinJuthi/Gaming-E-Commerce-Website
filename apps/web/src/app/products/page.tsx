import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  HOME_CONTAINER_CLS,
} from "@/components/home/home-container";
import { ProductCatalogGrid } from "@/components/ProductCatalogGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getProducts } from "@/lib/api";
import { buildMetadata, productPath } from "@/lib/seo";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/structured-data";

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string; type?: string }>;
}): Promise<Metadata> {
  const { search } = await searchParams;
  if (search) {
    const seo = await getCachedSeoConfig();
    return buildMetadata({
      title: `Search results for "${search}"`,
      description: `Products matching "${search}" on ${seo.siteTitle}.`,
      path: "/products",
      noIndex: true,
    });
  }
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/products", seo);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string; type?: string }>;
}) {
  const { search, sort, type } = await searchParams;

  // Redirect bare ?search= to the canonical /products URL
  if (search === "") redirect("/products");

  const cached = !search;
  const { items } = await getProducts({ limit: 24, search, sort, type }, { cached, revalidate: 60 });

  const emptyMessage = search
    ? `No products found for "${search}".`
    : "No products available yet.";

  const pageTitle = search ? `Search results for "${search}"` : "All Products";

  return (
    <main className={`${HOME_CONTAINER_CLS} pt-2 pb-10 sm:pt-4`}>
      {!search && items.length > 0 ? (
        <JsonLd
          data={[
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "All Products", path: "/products" },
            ]),
            itemListSchema(
              "All Products",
              items.map((p) => ({
                name: p.title,
                path: productPath(p.slug),
                image: p.media?.[0]?.url,
              })),
            ),
          ]}
        />
      ) : null}
      <header className="mb-2">
        <h1 className="text-lg font-bold text-foreground md:text-xl">{pageTitle}</h1>
      </header>

      {items.length === 0 ? (
        <div className="card-premium border-dashed p-12 text-center text-foreground-muted">
          {emptyMessage}
        </div>
      ) : (
        <section className="home-product-section pb-4 sm:pb-5">
          <ProductCatalogGrid products={items} emptyMessage={emptyMessage} />
        </section>
      )}
    </main>
  );
}
