import Link from "next/link";
import { ProductMediaBackground } from "@/components/product/ProductMediaBackground";
import type { BlogListItem } from "@/lib/api";
import { estimateReadingTimeMinutes } from "@/lib/blog-utils";
import { blogPostPath } from "@/lib/seo";
import { resolveMediaSrc } from "@/lib/site-appearance";

type BlogPostCardProps = {
  post: BlogListItem;
  priorityImage?: boolean;
};

export function BlogPostCard({ post, priorityImage = false }: BlogPostCardProps) {
  const image = resolveMediaSrc(post.featuredImage ?? "");
  const readingMinutes = estimateReadingTimeMinutes(undefined, post.excerpt);
  const title = post.title.trim();

  return (
    <Link
      href={blogPostPath(post.slug)}
      className="product-catalog-card group blog-catalog-card"
    >
      <div className="product-catalog-card-bg">
        <ProductMediaBackground
          compact
          fill
          staticPalette
          imageUrl={image}
          showBorder={false}
        />
      </div>

      <div className="product-catalog-card-body">
        <div className="product-catalog-card-visual">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="blog-catalog-card__image"
              loading={priorityImage ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priorityImage ? "high" : "auto"}
            />
          ) : (
            <div className="product-catalog-card-img-fallback">No image</div>
          )}
        </div>

        <div className="product-catalog-divider" aria-hidden />

        <h2 className="blog-catalog-card__title">{title}</h2>

        <div className="product-catalog-footer">
          <span className="product-catalog-price">{readingMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}
