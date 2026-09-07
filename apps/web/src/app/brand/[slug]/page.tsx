import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  HOME_CONTAINER_CLS,
} from "@/components/home/home-container";
import { ProductCatalogGrid } from "@/components/ProductCatalogGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBrand, getProducts } from "@/lib/api";
import { brandPath, productPath, SITE_NAME, toMetaText } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/structured-data";

export const revalidate = 300;

type PageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug, { cached: true, revalidate });
  if (!brand) {
    return { title: "Brand not found", robots: { index: false, follow: false } };
  }
  const title = `${brand.name} — Official Products`;
  const description =
    toMetaText(brand.seo?.metaDescription || brand.description, 200) ||
    `Shop ${brand.name} products on ${SITE_NAME} with instant delivery and secure checkout.`;
  return {
    title: brand.seo?.metaTitle || title,
    description,
    keywords: brand.seo?.keywords,
    alternates: { canonical: brandPath(brand.slug) },
    openGraph: {
      type: "website",
      title,
      description,
      url: brandPath(brand.slug),
      siteName: SITE_NAME,
      images: brand.logoUrl ? [{ url: brand.logoUrl }] : undefined,
    },
  };
}

export default async function BrandLandingPage({ params }: PageParams) {
  const { slug } = await params;
  const brand = await getBrand(slug, { cached: true, revalidate });
  if (!brand) {
    notFound();
  }

  const { items } = await getProducts(
    { brandId: brand._id, limit: 48, sort: "newest" },
    { cached: true, revalidate },
  );

  const schemas = [
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: brand.name, path: brandPath(brand.slug) },
    ]),
    itemListSchema(
      brand.name,
      items.map((p) => ({
        name: p.title,
        path: productPath(p.slug),
        image: p.media?.[0]?.url,
      })),
    ),
  ];

  return (
    <main className={`${HOME_CONTAINER_CLS} py-10`}>
      <JsonLd data={schemas} />
      <header className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-foreground-muted">
          <span>Home</span>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{brand.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-foreground">{brand.name}</h1>
        {brand.description ? (
          <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
            {toMetaText(brand.description, 240)}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="card-premium border-dashed p-12 text-center text-foreground-muted">
          No products from this brand yet.
        </div>
      ) : (
        <ProductCatalogGrid
          products={items}
          emptyMessage={`No ${brand.name} products yet.`}
        />
      )}
    </main>
  );
}
