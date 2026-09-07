import Link from "next/link";
import type { BlogPost } from "@/lib/api";
import { BlogAuthorAvatar } from "@/components/blog/BlogAuthorAvatar";
import { formatBlogAuthorName } from "@/lib/blog-author";
import { estimateReadingTimeMinutes, formatBlogDate } from "@/lib/blog-utils";
import type { BlogPageFeatures } from "@/lib/blog-page-settings";
import { DEFAULT_BLOG_PAGE_FEATURES } from "@/lib/blog-page-settings";
import { blogCategoryPath, blogPath } from "@/lib/seo";
import { resolveMediaSrc } from "@/lib/site-appearance";

type BlogPostHeroProps = {
  post: BlogPost;
  features?: BlogPageFeatures;
};

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function BlogPostHero({
  post,
  features = DEFAULT_BLOG_PAGE_FEATURES,
}: BlogPostHeroProps) {
  const image = resolveMediaSrc(post.featuredImage ?? "");
  const authorName = formatBlogAuthorName(post.author);
  const publishedLabel = formatBlogDate(post.publishedAt || post.createdAt);
  const updatedLabel = formatBlogDate(post.updatedAt);
  const readingMinutes = estimateReadingTimeMinutes(post.content, post.excerpt);
  const showUpdated =
    updatedLabel &&
    publishedLabel &&
    updatedLabel !== publishedLabel;

  return (
    <header className="blog-post-hero">
      <div className="blog-post-hero__top">
        {post.category ? (
          <p className="blog-post-hero__category">
            {post.categorySlug ? (
              <Link href={blogCategoryPath(post.categorySlug)}>{post.category}</Link>
            ) : (
              post.category
            )}
          </p>
        ) : (
          <span className="blog-post-hero__top-spacer" aria-hidden />
        )}
        <Link href={blogPath() as "/"} className="blog-post-hero__back">
          <span className="blog-post-hero__back-icon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </span>
          <span className="blog-post-hero__back-label">Back to articles</span>
        </Link>
      </div>
      <h1 className="blog-post-hero__title">{post.title}</h1>

      {post.excerpt ? (
        <p className="blog-post-hero__excerpt">{post.excerpt}</p>
      ) : null}

      <div className="blog-post-hero__byline" aria-label="Article details">
        {features.authorProfileEnabled ? (
          <div className="blog-post-hero__author">
            <BlogAuthorAvatar
              name={authorName}
              avatarUrl={post.author.avatarUrl}
            />
            <div className="blog-post-hero__author-copy">
              <span className="blog-post-hero__author-label">Author</span>
              <span className="blog-post-hero__author-name">{authorName}</span>
            </div>
          </div>
        ) : null}

        <div
          className={`blog-post-hero__byline-stats${
            features.authorProfileEnabled ? "" : " blog-post-hero__byline-stats--solo"
          }`}
        >
          {publishedLabel ? (
            <div className="blog-post-hero__stat">
              <span className="blog-post-hero__stat-icon" aria-hidden>
                <CalendarIcon className="h-4 w-4" />
              </span>
              <div className="blog-post-hero__stat-copy">
                <span className="blog-post-hero__stat-label">Published</span>
                <time
                  className="blog-post-hero__stat-value"
                  dateTime={post.publishedAt || post.createdAt}
                >
                  {publishedLabel}
                </time>
              </div>
            </div>
          ) : null}

          {showUpdated ? (
            <div className="blog-post-hero__stat">
              <span className="blog-post-hero__stat-icon" aria-hidden>
                <CalendarIcon className="h-4 w-4" />
              </span>
              <div className="blog-post-hero__stat-copy">
                <span className="blog-post-hero__stat-label">Updated</span>
                <time className="blog-post-hero__stat-value" dateTime={post.updatedAt}>
                  {updatedLabel}
                </time>
              </div>
            </div>
          ) : null}

          {features.readingTimeEnabled ? (
            <div className="blog-post-hero__stat">
              <span className="blog-post-hero__stat-icon" aria-hidden>
                <ClockIcon className="h-4 w-4" />
              </span>
              <div className="blog-post-hero__stat-copy">
                <span className="blog-post-hero__stat-label">Reading time</span>
                <span className="blog-post-hero__stat-value">{readingMinutes} min</span>
              </div>
            </div>
          ) : null}

          {features.viewsEnabled ? (
            <div className="blog-post-hero__stat blog-post-hero__stat--muted">
              <span className="blog-post-hero__stat-icon" aria-hidden>
                <EyeIcon className="h-4 w-4" />
              </span>
              <div className="blog-post-hero__stat-copy">
                <span className="blog-post-hero__stat-label">Views</span>
                <span className="blog-post-hero__stat-value">
                  {post.views.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {image ? (
        <figure className="blog-post-hero__cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={post.title}
            className="blog-post-hero__cover-image"
            loading="eager"
            decoding="async"
          />
        </figure>
      ) : null}
    </header>
  );
}
