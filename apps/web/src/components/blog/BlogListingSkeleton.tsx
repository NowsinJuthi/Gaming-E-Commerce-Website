export function BlogListingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="home-product-section-grid product-catalog-page-grid blog-grid"
      aria-busy="true"
      aria-label="Loading blog posts"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="home-product-section-grid__item blog-catalog-card blog-catalog-card--skeleton"
        >
          <div className="product-catalog-card-visual blog-skeleton-block" />
          <div className="product-catalog-divider blog-skeleton-block" />
          <div className="blog-skeleton-line blog-skeleton-line--title" />
          <div className="product-catalog-footer">
            <div className="blog-skeleton-line blog-skeleton-line--meta" />
          </div>
        </div>
      ))}
    </div>
  );
}
