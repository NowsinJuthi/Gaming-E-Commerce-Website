import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BlogListingView } from "@/components/blog/BlogListingView";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBlogCategoryBySlug } from "@/lib/api";
import {
  blogCategoryPath,
  blogPath,
  buildMetadata,
  SITE_NAME,
  toMetaText,
} from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/structured-data";

export const revalidate = 300;

type PageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const category = await getBlogCategoryBySlug(slug, { cached: true, revalidate });
  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const title = category.seo?.metaTitle?.trim() || `${category.name} — Blog`;
  const description =
    toMetaText(category.seo?.metaDescription || category.description, 200) ||
    `Browse ${category.name} articles on the ${SITE_NAME} blog.`;

  return buildMetadata({
    title,
    description,
    path: blogCategoryPath(category.slug),
    canonicalUrl: category.seo?.canonicalUrl,
    images: category.seo?.ogImage ? [category.seo.ogImage] : undefined,
    keywords: category.seo?.keywords,
  });
}

export default async function BlogCategoryPage({ params }: PageParams) {
  const { slug } = await params;
  const category = await getBlogCategoryBySlug(slug, { cached: true, revalidate });
  if (!category) notFound();

  const schemas = [
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: blogPath() },
      { name: category.name, path: blogCategoryPath(category.slug) },
    ]),
  ];

  return (
    <>
      <JsonLd data={schemas} />
      <Suspense fallback={null}>
        <BlogListingView
          categorySlug={category.slug}
          heading={category.name}
          description={category.description}
        />
      </Suspense>
    </>
  );
}
