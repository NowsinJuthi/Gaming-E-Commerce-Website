import Link from "next/link";
import { blogPath } from "@/lib/seo";

export function BlogEmptyState() {
  return (
    <div className="blog-empty card-premium border-dashed" role="status">
      <div className="blog-empty__icon" aria-hidden>
        ✦
      </div>
      <h2 className="blog-empty__title">No blog posts yet</h2>
      <p className="blog-empty__text">
        We are preparing helpful guides, updates, and stories. Check back soon
        for fresh content.
      </p>
      <Link href="/" className="btn-secondary btn-secondary-sm">
        Back to home
      </Link>
    </div>
  );
}

export function BlogErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="blog-empty card-premium border-dashed" role="alert">
      <div className="blog-empty__icon blog-empty__icon--error" aria-hidden>
        !
      </div>
      <h2 className="blog-empty__title">Could not load blog posts</h2>
      <p className="blog-empty__text">
        Something went wrong while fetching articles. Please try again.
      </p>
      <div className="blog-empty__actions">
        <button type="button" className="btn-primary btn-primary-sm" onClick={onRetry}>
          Try again
        </button>
        <Link href={blogPath()} className="btn-secondary btn-secondary-sm">
          Refresh page
        </Link>
      </div>
    </div>
  );
}
