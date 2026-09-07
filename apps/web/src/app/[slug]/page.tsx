import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryLandingView } from "@/components/category/CategoryLandingView";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { JsonLd } from "@/components/seo/JsonLd";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import {
  ProductSchema,
  toReviewSchemaEntries,
} from "@/components/seo/ProductSchema";
import {
  categoryTrail,
  fetchProductReviews,
  flattenCategoryTree,
  getBrands,
  getCategories,
  type Brand,
  type ProductReviewsPage,
} from "@/lib/api";
import { resolveSlugPage } from "@/lib/category-page";
import { getCachedSeoConfig } from "@/lib/server-cache";
import {
  buildMetadata,
  categoryPath,
  productPath,
  SITE_NAME,
  toMetaText,
} from "@/lib/seo";
import {
  galleryImageUrls,
  getShortDescription,
  isProductInStock,
  parseProductVariations,
} from "@/lib/product-page";
import { faqSchema, type FaqEntry } from "@/lib/structured-data";

export const revalidate = 120;

type PageParams = { params: Promise<{ slug: string }> };

function resolveDescription(product: {
  seo?: { metaDescription?: string };
  attributes?: Record<string, unknown>;
  description?: string;
  title: string;
}): string {
  return (
    product.seo?.metaDescription ||
    getShortDescription(product.attributes) ||
    product.description ||
    ""
  );
}

function extractFaq(attrs?: Record<string, unknown>): FaqEntry[] {
  const raw = (attrs?.faq ?? attrs?.faqs) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const v = item as Record<string, unknown>;
      const question = String(v.question ?? v.q ?? "").trim();
      const answer = String(v.answer ?? v.a ?? "").trim();
      return { question, answer };
    })
    .filter((entry) => entry.question && entry.answer);
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveSlugPage(slug, revalidate);

  if (resolved.kind === "category") {
    const { category } = resolved;
    const title = `${category.name} — Buy ${category.name} Online`;
    const description = `Browse ${category.name} on ${SITE_NAME}. Instant delivery, secure checkout and the best prices on digital goods.`;
    return {
      title,
      description,
      alternates: { canonical: categoryPath(category.slug) },
      openGraph: {
        type: "website",
        title,
        description,
        url: categoryPath(category.slug),
        siteName: SITE_NAME,
      },
    };
  }

  if (resolved.kind !== "product") {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const product = resolved.product;
  const title = product.seo?.metaTitle || product.title;
  const description = toMetaText(resolveDescription(product), 200);
  const image = product.seo?.ogImage || product.media?.[0]?.url;
  const canonicalPath =
    product.seo?.canonicalUrl?.startsWith("http")
      ? new URL(product.seo.canonicalUrl).pathname
      : product.seo?.canonicalUrl || productPath(product.slug);

  return buildMetadata({
    title,
    description,
    keywords: product.seo?.keywords,
    path: canonicalPath,
    images: image ? [image] : undefined,
  });
}

export default async function SlugPage({ params }: PageParams) {
  const { slug } = await params;
  const resolved = await resolveSlugPage(slug, revalidate);

  if (resolved.kind === "category") {
    return <CategoryLandingView category={resolved.category} />;
  }

  if (resolved.kind !== "product") {
    notFound();
  }

  const product = resolved.product;

  const emptyReviews: ProductReviewsPage = {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    summary: { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
  };

  const [brands, categoryTree, reviewsPage, seoConfig] = await Promise.all([
    product.brandId
      ? getBrands({ cached: true, revalidate: 300 })
      : Promise.resolve<Brand[]>([]),
    product.categoryId
      ? getCategories({ cached: true, revalidate: 300 })
      : Promise.resolve([]),
    fetchProductReviews(product._id, 1, 10, {
      cached: true,
      revalidate,
    }).catch(() => emptyReviews),
    getCachedSeoConfig(),
  ]);

  const brand = product.brandId
    ? brands.find((b) => b._id === product.brandId)
    : undefined;
  const flatCategories = flattenCategoryTree(categoryTree);
  const category = product.categoryId
    ? flatCategories.find((c) => c._id === product.categoryId)
    : undefined;
  const breadcrumbCategories = category
    ? categoryTrail(category, flatCategories)
    : [];

  const description = toMetaText(resolveDescription(product), 5000);
  const images = galleryImageUrls(
    product,
    parseProductVariations(product.attributes),
  );

  const rating =
    reviewsPage.summary.count > 0 ? reviewsPage.summary : product.ratings;

  const faq = extractFaq(product.attributes);
  const siteUrl = seoConfig.canonicalDomain.replace(/\/$/, "");

  return (
    <>
      {seoConfig.schema.product ? (
        <ProductSchema
          name={product.title}
          description={description}
          images={images}
          sku={product.sku}
          productId={product._id}
          brandName={brand?.name}
          category={category?.name}
          url={productPath(product.slug)}
          price={product.pricing.basePrice}
          currency={product.pricing.currency}
          inStock={isProductInStock(product)}
          rating={rating}
          reviews={toReviewSchemaEntries(reviewsPage.items)}
          siteUrl={siteUrl}
        />
      ) : null}
      <BreadcrumbSchema
        siteUrl={siteUrl}
        items={[
          { name: "Home", path: "/" },
          ...breadcrumbCategories.map((c) => ({
            name: c.name,
            path: categoryPath(c.slug),
          })),
          { name: product.title, path: productPath(product.slug) },
        ]}
      />
      {faq.length > 0 ? <JsonLd data={faqSchema(faq)} /> : null}
      <ProductDetailView product={product} />
    </>
  );
}
