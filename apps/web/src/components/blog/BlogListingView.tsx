"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BlogArticleSidebar } from "@/components/blog/BlogArticleSidebar";
import { BlogEmptyState, BlogErrorState } from "@/components/blog/BlogEmptyState";
import { BlogHeroPanel } from "@/components/blog/BlogHeroPanel";
import { BlogListingSkeleton } from "@/components/blog/BlogListingSkeleton";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { getBlogPosts, listBlogCategories } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PAGE_SIZE = 12;

type BlogListingViewProps = {
  categorySlug?: string;
  heading?: string;
  description?: string;
};

export function BlogListingView({
  categorySlug,
  heading = "UniQbd Blog",
  description = "Guides, product news, and digital shopping tips from the UniQbd team.",
}: BlogListingViewProps = {}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);

  useEffect(() => {
    const next = searchParams.get("q")?.trim() ?? "";
    setSearch(next);
    setSearchDraft(next);
    setPage(1);
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(categorySlug ? { categorySlug } : {}),
      ...(search ? { q: search } : {}),
    }),
    [page, categorySlug, search],
  );

  const categoriesQuery = useQuery({
    queryKey: queryKeys.blog.categories(),
    queryFn: () => listBlogCategories(),
    staleTime: 300_000,
  });

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.blog.list(filters),
    queryFn: () => getBlogPosts(filters),
    placeholderData: (previous) => previous,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  function applySearch(query: string) {
    setSearch(query);
    setSearchDraft(query);
    setPage(1);
  }

  return (
    <main className={`${HOME_CONTAINER_CLS} blog-page py-10 md:py-12`}>
      <BlogHeroPanel
        heading={heading}
        description={description}
        badge={categorySlug ? "Category" : "Blog Center"}
        searchQuery={search || undefined}
      />

      <div className="blog-page__layout">
        <BlogArticleSidebar
          categories={categoriesQuery.data ?? []}
          activeCategorySlug={categorySlug}
          listingSearch={{
            value: searchDraft,
            onSearch: (query) => {
              setSearchDraft(query);
              applySearch(query);
            },
          }}
        />

        <div className="blog-page__main">
          {isLoading && !data ? <BlogListingSkeleton /> : null}

          {isError ? <BlogErrorState onRetry={() => void refetch()} /> : null}

          {!isLoading && !isError && data?.items.length === 0 ? (
            <BlogEmptyState />
          ) : null}

          {!isError && data && data.items.length > 0 ? (
            <>
              <div
                className="home-product-section-grid product-catalog-page-grid blog-grid"
                aria-live="polite"
              >
                {data.items.map((post, index) => (
                  <div key={post.id} className="home-product-section-grid__item">
                    <BlogPostCard
                      post={post}
                      priorityImage={page === 1 && index < 2}
                    />
                  </div>
                ))}
              </div>

              {totalPages > 1 ? (
                <nav
                  className="blog-pagination"
                  aria-label="Blog pagination"
                >
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </button>
                  <span className="blog-pagination__status">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    Next
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
