import Link from "next/link";
import type { BlogListItem } from "@/lib/api";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { blogPostPath } from "@/lib/seo";

type BlogRelatedPostsProps = {
  posts: BlogListItem[];
  heading?: string;
};

export function BlogRelatedPosts({
  posts,
  heading = "Related articles",
}: BlogRelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="blog-related" aria-labelledby="blog-related-heading">
      <h2 id="blog-related-heading" className="blog-related__title">
        {heading}
      </h2>
      <div className="home-product-section-grid product-catalog-page-grid blog-grid blog-grid--related">
        {posts.map((post) => (
          <div key={post.id} className="home-product-section-grid__item">
            <BlogPostCard post={post} />
          </div>
        ))}
      </div>
    </section>
  );
}

type BlogNeighbor = Pick<BlogListItem, "title" | "slug"> | null;

type BlogPostNavigationProps = {
  previousPost: BlogNeighbor;
  nextPost: BlogNeighbor;
};

export function BlogPostNavigation({
  previousPost,
  nextPost,
}: BlogPostNavigationProps) {
  if (!previousPost && !nextPost) return null;

  return (
    <nav className="blog-post-nav" aria-label="Article navigation">
      {previousPost ? (
        <Link href={blogPostPath(previousPost.slug)} className="blog-post-nav__item">
          <span className="blog-post-nav__label">Previous</span>
          <span className="blog-post-nav__title">{previousPost.title}</span>
        </Link>
      ) : (
        <div className="blog-post-nav__item blog-post-nav__item--empty" />
      )}

      {nextPost ? (
        <Link
          href={blogPostPath(nextPost.slug)}
          className="blog-post-nav__item blog-post-nav__item--next"
        >
          <span className="blog-post-nav__label">Next</span>
          <span className="blog-post-nav__title">{nextPost.title}</span>
        </Link>
      ) : (
        <div className="blog-post-nav__item blog-post-nav__item--empty" />
      )}
    </nav>
  );
}
