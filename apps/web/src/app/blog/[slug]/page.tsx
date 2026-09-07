import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostContent } from "@/components/blog/BlogPostContent";
import { BlogArticleEngagement } from "@/components/blog/BlogArticleEngagement";
import { BlogArticleSidebar } from "@/components/blog/BlogArticleSidebar";
import { BlogPostHero } from "@/components/blog/BlogPostHero";
import {
  BlogPostNavigation,
  BlogRelatedPosts,
} from "@/components/blog/BlogRelatedPosts";
import { BlogShareButtons } from "@/components/blog/BlogShareButtons";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBlogPost, getBlogPosts, getBlogPageSettings, listBlogCategories, type BlogListItem } from "@/lib/api";
import {
  blogCategoryPath,
  blogPath,
  blogPostPath,
  buildMetadata,
  SITE_NAME,
  toMetaText,
} from "@/lib/seo";
import { blogArticleSchema, breadcrumbSchema } from "@/lib/structured-data";

export const revalidate = 300;

type PageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug, { cached: true, revalidate });
  if (!post) {
    return { title: "Article not found", robots: { index: false, follow: false } };
  }

  const title = post.metaTitle?.trim() || post.title;
  const description =
    toMetaText(post.metaDescription || post.excerpt, 200) ||
    `Read ${post.title} on the ${SITE_NAME} blog.`;
  const shareImage = post.ogImage?.trim() || post.featuredImage?.trim();
  const keywords = [
    ...(post.focusKeyword ? [post.focusKeyword] : []),
    ...(post.tags ?? []),
  ];

  return buildMetadata({
    title,
    description,
    path: blogPostPath(post.slug),
    canonicalUrl: post.canonicalUrl,
    images: shareImage ? [shareImage] : undefined,
    keywords,
    type: "article",
    publishedTime: post.publishedAt || post.createdAt,
    modifiedTime: post.updatedAt,
  });}

function pickNeighbors(
  posts: BlogListItem[],
  currentSlug: string,
): {
  previousPost: Pick<BlogListItem, "title" | "slug"> | null;
  nextPost: Pick<BlogListItem, "title" | "slug"> | null;
} {
  const index = posts.findIndex((item) => item.slug === currentSlug);
  if (index < 0) {
    return { previousPost: null, nextPost: null };
  }
  const newer = index > 0 ? posts[index - 1] : null;
  const older = index < posts.length - 1 ? posts[index + 1] : null;
  return {
    previousPost: older ? { title: older.title, slug: older.slug } : null,
    nextPost: newer ? { title: newer.title, slug: newer.slug } : null,
  };
}

export default async function BlogPostPage({ params }: PageParams) {
  const { slug } = await params;
  const post = await getBlogPost(slug, { cached: true, revalidate });
  if (!post) notFound();

  const [categoryPosts, allPosts, categories, pageSettings] = await Promise.all([
    post.categorySlug || post.category
      ? getBlogPosts(
          {
            categorySlug: post.categorySlug,
            category: post.categorySlug ? undefined : post.category,
            limit: 8,
          },
          { cached: true, revalidate },
        )
      : Promise.resolve({ items: [], total: 0, page: 1, limit: 8 }),
    getBlogPosts({ limit: 50 }, { cached: true, revalidate }),
    listBlogCategories({ cached: true, revalidate }),
    getBlogPageSettings({ cached: true, revalidate }),
  ]);

  const features = pageSettings.features;

  const relatedPosts = categoryPosts.items
    .filter((item) => item.slug !== post.slug)
    .slice(0, 3);

  const { previousPost, nextPost } = pickNeighbors(allPosts.items, post.slug);

  const shareImage = post.ogImage?.trim() || post.featuredImage?.trim();
  const keywords = [
    ...(post.focusKeyword ? [post.focusKeyword] : []),
    ...(post.tags ?? []),
  ];

  const categoryBreadcrumb =
    post.category && post.categorySlug
      ? [{ name: post.category, path: blogCategoryPath(post.categorySlug) }]
      : post.category
        ? [{ name: post.category, path: blogPath() }]
        : [];

  const schemas = [
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: blogPath() },
      ...categoryBreadcrumb,
      { name: post.title, path: blogPostPath(post.slug) },
    ]),
    blogArticleSchema({
      title: post.title,
      description: toMetaText(post.metaDescription || post.excerpt, 240),
      url: blogPostPath(post.slug),
      canonicalUrl: post.canonicalUrl,
      image: shareImage,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt,
      authorName: post.author?.name || post.author?.email,
      keywords,
      articleSection: post.category,
    }),
  ];

  return (
    <main className={`${HOME_CONTAINER_CLS} blog-post-page py-10 md:py-12`}>
      <JsonLd data={schemas} />

      <div className="blog-post-page__layout">
        <BlogArticleSidebar
          categories={categories}
          activeCategorySlug={post.categorySlug}
          articlePage
        />

        <div className="blog-post-page__center">
        <div className="blog-post-article">
          <span className="blog-post-article__accent" aria-hidden />
          <article className="blog-post-article__main">
            <BlogPostHero post={post} features={features} />
            <BlogPostContent html={post.content} />
            <BlogArticleEngagement
              slug={post.slug}
              likeCount={post.likeCount ?? 0}
              dislikeCount={post.dislikeCount ?? 0}
              features={features}
            />
          </article>
          {features.shareButtonsEnabled ? (
          <footer className="blog-post-article__footer">
            <BlogShareButtons
              title={post.title}
              slug={post.slug}
              excerpt={post.excerpt}
            />
          </footer>
          ) : null}
        </div>

        {features.relatedPostsEnabled ? (
          <>
        <BlogPostNavigation previousPost={previousPost} nextPost={nextPost} />
        <BlogRelatedPosts posts={relatedPosts} />
          </>
        ) : null}
        </div>
      </div>
    </main>
  );
}
