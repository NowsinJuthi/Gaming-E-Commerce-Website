import { HOME_CONTAINER_CLS } from "@/components/home/home-container";

export default function BlogPostLoadingPage() {
  return (
    <main className={`${HOME_CONTAINER_CLS} blog-post-page py-10 md:py-12`}>
      <div className="blog-post-page__center">
        <div className="blog-skeleton-line blog-skeleton-line--breadcrumb" />
        <div className="blog-post-article blog-post-article--skeleton">
          <div className="blog-skeleton-line blog-skeleton-line--hero" />
          <div className="blog-skeleton-line blog-skeleton-line--meta" />
          <div className="blog-post-hero__cover blog-skeleton-block" />
          <div className="blog-post-content blog-post-content--skeleton">
            <div className="blog-skeleton-line" />
            <div className="blog-skeleton-line" />
            <div className="blog-skeleton-line blog-skeleton-line--short" />
            <div className="blog-skeleton-line" />
          </div>
        </div>
      </div>
    </main>
  );
}
