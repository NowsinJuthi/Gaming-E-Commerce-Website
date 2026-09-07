import type { MetadataRoute } from "next";
import { getBlogPosts, getBrands, getCategories, getProducts, flattenCategoryTree, listBlogCategories } from "@/lib/api";
import {
  absoluteUrl,
  blogCategoryPath,
  blogPath,
  blogPostPath,
  brandPath,
  categoryPath,
  fetchSeoConfig,
  isReservedSlug,
  productPath,
} from "@/lib/seo";

export const revalidate = 3600;

/** Hard cap so sitemap generation stays bounded (well under the 50k/file limit). */
const MAX_PRODUCTS = 5000;
const MAX_BLOG_POSTS = 2000;
const PAGE_SIZE = 100;

async function collectProducts(): Promise<
  Array<{ slug: string; image?: string }>
> {
  const out: Array<{ slug: string; image?: string }> = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PRODUCTS / PAGE_SIZE; page += 1) {
    const res = await getProducts(
      { limit: PAGE_SIZE, sort: "newest", cursor },
      { cached: true, revalidate },
    );
    for (const item of res.items) {
      if (item.slug && !isReservedSlug(item.slug)) {
        out.push({ slug: item.slug, image: item.media?.[0]?.url });
      }
    }
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return out;
}

async function collectBlogPosts(): Promise<
  Array<{ slug: string; updatedAt?: string; image?: string }>
> {
  const out: Array<{ slug: string; updatedAt?: string; image?: string }> = [];
  for (let page = 1; page <= MAX_BLOG_POSTS / PAGE_SIZE; page += 1) {
    const res = await getBlogPosts(
      { limit: PAGE_SIZE, page },
      { cached: true, revalidate },
    );
    for (const item of res.items) {
      if (item.slug) {
        out.push({
          slug: item.slug,
          updatedAt: item.updatedAt || item.publishedAt || item.createdAt,
          image: item.ogImage || item.featuredImage,
        });
      }
    }
    if (page * PAGE_SIZE >= res.total) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const seo = await fetchSeoConfig();
  const siteUrl = seo.canonicalDomain.replace(/\/$/, "");
  const url = (path: string) => absoluteUrl(path, siteUrl);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: url("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: url("/products"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: url("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: url("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: url("/website"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: url("/request-product"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: url("/reviews"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.65,
    },
    {
      url: url(blogPath()),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.75,
    },
    {
      url: url("/refund-and-returns-policy/"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: url("/terms-conditions/"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: url("/privacy-policy/"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: url("/disclaimers/"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const [categories, brands, products, blogPosts, blogCategories] = await Promise.all([
    getCategories({ cached: true, revalidate }).catch(() => []),
    getBrands({ cached: true, revalidate }).catch(() => []),
    collectProducts().catch(() => []),
    collectBlogPosts().catch(() => []),
    listBlogCategories({ cached: true, revalidate }).catch(() => []),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = flattenCategoryTree(categories)
    .filter((c) => c.slug && c.isActive !== false)
    .map((c) => ({
      url: url(categoryPath(c.slug)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const brandEntries: MetadataRoute.Sitemap = brands
    .filter((b) => b.slug && b.isActive !== false)
    .map((b) => ({
      url: url(brandPath(b.slug)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: url(productPath(p.slug)),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
    ...(p.image ? { images: [absoluteUrl(p.image, siteUrl)] } : {}),
  }));

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: url(blogPostPath(post.slug)),
    lastModified: post.updatedAt ? new Date(post.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
    ...(post.image ? { images: [absoluteUrl(post.image, siteUrl)] } : {}),
  }));

  const blogCategoryEntries: MetadataRoute.Sitemap = blogCategories
    .filter((c) => c.slug && c.isActive !== false)
    .map((c) => ({
      url: url(blogCategoryPath(c.slug)),
      lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(c.seo?.ogImage ? { images: [absoluteUrl(c.seo.ogImage, siteUrl)] } : {}),
    }));

  return [
    ...staticEntries,
    ...categoryEntries,
    ...brandEntries,
    ...productEntries,
    ...blogEntries,
    ...blogCategoryEntries,
  ];
}
