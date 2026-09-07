import { BlogListingSkeleton } from "@/components/blog/BlogListingSkeleton";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";

export default function BlogLoadingPage() {
  return (
    <main className={`${HOME_CONTAINER_CLS} blog-page py-10 md:py-12`}>
      <header className="blog-page__header">
        <div className="blog-skeleton-line blog-skeleton-line--eyebrow" />
        <div className="blog-skeleton-line blog-skeleton-line--hero" />
        <div className="blog-skeleton-line blog-skeleton-line--subtitle" />
      </header>
      <BlogListingSkeleton />
    </main>
  );
}
