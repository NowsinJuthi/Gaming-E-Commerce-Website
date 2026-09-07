"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/admin/icons";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { ReviewsHeroPanel } from "@/components/reviews/ReviewsHeroPanel";
import {
  ALL_REVIEWS_PAGE_SIZE,
  fetchAllReviews,
  fetchReviewFilters,
  type AllReviewsPage,
  type PublicReviewListItem,
  type ReviewFilterCategory,
  type ReviewFilterProduct,
  type ReviewFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { categoryPath, productPath } from "@/lib/seo";

export type ReviewFilterSelection =
  | { type: "all" }
  | { type: "product"; id: string; label: string }
  | { type: "category"; id: string; label: string };

type ReviewsFilterSidebarProps = {
  filters: ReviewFilters | undefined;
  selection: ReviewFilterSelection;
  onSelect: (selection: ReviewFilterSelection) => void;
  loading?: boolean;
};

function FilterCount({ count }: { count: number }) {
  return <span className="reviews-page-filter-count">{count}</span>;
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`reviews-page-filter-link${active ? " reviews-page-filter-link--active" : ""}`}
      >
        <span className="reviews-page-filter-link__label">{label}</span>
        {count !== undefined ? <FilterCount count={count} /> : null}
      </button>
    </li>
  );
}

export function ReviewsFilterSidebar({
  filters,
  selection,
  onSelect,
  loading,
}: ReviewsFilterSidebarProps) {
  if (loading && !filters) {
    return (
      <aside className="reviews-page-sidebar" aria-label="Review filters">
        <div className="reviews-page-sidebar__skeleton" aria-hidden />
      </aside>
    );
  }

  return (
    <aside className="reviews-page-sidebar" aria-label="Review filters">
      <nav className="reviews-page-filter-menu">
        <div className="reviews-page-filter-section">
          <p className="reviews-page-filter-heading">Browse</p>
          <ul className="reviews-page-filter-list">
            <FilterButton
              active={selection.type === "all"}
              label="All reviews"
              onClick={() => onSelect({ type: "all" })}
            />
          </ul>
        </div>

        <div className="reviews-page-filter-section">
          <p className="reviews-page-filter-heading">Categories</p>
          <ul className="reviews-page-filter-list">
            {(filters?.categories ?? []).map((category: ReviewFilterCategory) => (
              <FilterButton
                key={category.id}
                active={
                  selection.type === "category" && selection.id === category.id
                }
                label={category.name}
                count={category.reviewCount}
                onClick={() =>
                  onSelect({
                    type: "category",
                    id: category.id,
                    label: category.name,
                  })
                }
              />
            ))}
          </ul>
        </div>

        <div className="reviews-page-filter-section">
          <p className="reviews-page-filter-heading">Products</p>
          <ul className="reviews-page-filter-list">
            {(filters?.products ?? []).map((product: ReviewFilterProduct) => (
              <FilterButton
                key={product.id}
                active={
                  selection.type === "product" && selection.id === product.id
                }
                label={product.title}
                count={product.reviewCount}
                onClick={() =>
                  onSelect({
                    type: "product",
                    id: product.id,
                    label: product.title,
                  })
                }
              />
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}

type ReviewsSearchBoxProps = {
  filters: ReviewFilters | undefined;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSelectProduct: (product: ReviewFilterProduct) => void;
  onSelectCategory: (category: ReviewFilterCategory) => void;
  showClear: boolean;
};

function ReviewsSearchBox({
  filters,
  value,
  onChange,
  onClear,
  onSelectProduct,
  onSelectCategory,
  showClear,
}: ReviewsSearchBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term || !filters) {
      return { categories: [], products: [] };
    }

    const categories = filters.categories
      .filter((category) => category.name.toLowerCase().includes(term))
      .slice(0, 8);

    const products = filters.products
      .filter((product) => product.title.toLowerCase().includes(term))
      .slice(0, 8);

    return { categories, products };
  }, [value, filters]);

  const hasSuggestions =
    value.trim().length >= 1 &&
    (suggestions.categories.length > 0 || suggestions.products.length > 0);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="reviews-page-search-wrap">
      <div ref={boxRef} className="reviews-page-search">
        <label className="reviews-page-search__field" htmlFor="reviews-search">
          <SearchIcon className="reviews-page-search__icon" aria-hidden />
          <input
            id="reviews-search"
            type="search"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search by product or category…"
            className="reviews-page-search__input"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions && hasSuggestions}
            aria-controls="reviews-search-suggest"
            aria-autocomplete="list"
          />
        </label>

        {showSuggestions && hasSuggestions ? (
          <div
            id="reviews-search-suggest"
            className="reviews-page-search-suggest"
            role="listbox"
          >
            {suggestions.categories.length > 0 ? (
              <div className="reviews-page-search-suggest__group">
                <p className="reviews-page-search-suggest__heading">Categories</p>
                {suggestions.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    className="reviews-page-search-suggest__item"
                    onClick={() => {
                      onSelectCategory(category);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="reviews-page-search-suggest__label">
                      {category.name}
                    </span>
                    <span className="reviews-page-search-suggest__meta">
                      {category.reviewCount} reviews
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {suggestions.products.length > 0 ? (
              <div className="reviews-page-search-suggest__group">
                <p className="reviews-page-search-suggest__heading">Products</p>
                {suggestions.products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    className="reviews-page-search-suggest__item"
                    onClick={() => {
                      onSelectProduct(product);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="reviews-page-search-suggest__label">
                      {product.title}
                    </span>
                    <span className="reviews-page-search-suggest__meta">
                      {product.reviewCount} reviews
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showClear ? (
        <button
          type="button"
          className="btn-secondary btn-secondary-sm"
          onClick={onClear}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function customerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReviewStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="product-pdp-review-stars-display product-pdp-review-stars-display--sm"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={
            index < rounded
              ? "product-pdp-review-star product-pdp-review-star--filled"
              : "product-pdp-review-star"
          }
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewListCard({ review }: { review: PublicReviewListItem }) {
  const productHref = review.productSlug
    ? productPath(review.productSlug)
    : null;
  const categoryHref = review.categorySlug
    ? categoryPath(review.categorySlug)
    : null;

  return (
    <article className="reviews-page-card product-pdp-review-card">
      <div className="reviews-page-card__meta">
        {productHref ? (
          <Link href={productHref} className="reviews-page-card__meta-product">
            {review.productTitle}
          </Link>
        ) : (
          <span className="reviews-page-card__meta-product">{review.productTitle}</span>
        )}
        {review.categoryName ? (
          <>
            <span className="reviews-page-card__meta-sep" aria-hidden>
              ·
            </span>
            {categoryHref ? (
              <Link href={categoryHref} className="reviews-page-card__meta-category">
                {review.categoryName}
              </Link>
            ) : (
              <span className="reviews-page-card__meta-category">
                {review.categoryName}
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className="product-pdp-review-card-head">
        <div className="product-pdp-review-author">
          <span className="product-pdp-review-avatar" aria-hidden>
            {customerInitial(review.customerName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="product-pdp-review-author-name">{review.customerName}</p>
              <span className="product-pdp-review-verified">Verified buyer</span>
            </div>
            <div className="product-pdp-review-author-meta">
              <ReviewStars rating={review.rating} />
              <span>{formatReviewDate(review.createdAt)}</span>
            </div>
          </div>
        </div>
        <span className="product-pdp-review-rating-badge">{review.rating}.0</span>
      </div>

      <div className="product-pdp-review-card-body">
        {review.title ? (
          <p className="product-pdp-review-title">{review.title}</p>
        ) : null}
        <p className="product-pdp-review-text">{review.body}</p>
      </div>

      {review.adminReply?.trim() ? (
        <div className="product-pdp-review-reply">
          <p className="product-pdp-review-reply-label">Store response</p>
          <p className="product-pdp-review-reply-text">{review.adminReply}</p>
        </div>
      ) : null}
    </article>
  );
}

function ReviewsListingSkeleton() {
  return (
    <div className="reviews-page-list" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="reviews-page-card reviews-page-card--skeleton" />
      ))}
    </div>
  );
}

function selectionLabel(selection: ReviewFilterSelection): string | null {
  if (selection.type === "all") return null;
  return selection.label;
}

export function ReviewsListingView({
  initialFilters,
  initialReviews,
}: {
  initialFilters?: ReviewFilters;
  initialReviews?: AllReviewsPage;
} = {}) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<ReviewFilterSelection>({
    type: "all",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listFilters = useMemo(
    () => ({
      page,
      limit: ALL_REVIEWS_PAGE_SIZE,
      ...(selection.type === "all" && searchQuery ? { q: searchQuery } : {}),
      ...(selection.type === "product" ? { productId: selection.id } : {}),
      ...(selection.type === "category" ? { categoryId: selection.id } : {}),
    }),
    [page, searchQuery, selection],
  );

  const { data: filterData, isLoading: filtersLoading } = useQuery({
    queryKey: queryKeys.reviews.filters(),
    queryFn: () => fetchReviewFilters(),
    initialData: initialFilters,
    staleTime: 5 * 60_000,
  });

  const useInitialReviews =
    page === 1 &&
    selection.type === "all" &&
    !searchQuery &&
    initialReviews !== undefined;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.reviews.list(listFilters),
    queryFn: () =>
      fetchAllReviews(
        listFilters.page,
        listFilters.limit,
        listFilters.q,
        {
          productId: listFilters.productId,
          categoryId: listFilters.categoryId,
        },
      ),
    initialData: useInitialReviews ? initialReviews : undefined,
    placeholderData: (previous) => previous,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const activeFilterLabel = selectionLabel(selection);
  const totalPublishedReviews = useMemo(() => {
    if (!filterData?.products.length) return undefined;
    return filterData.products.reduce((sum, product) => sum + product.reviewCount, 0);
  }, [filterData]);

  function handleFilterSelect(next: ReviewFilterSelection) {
    setSelection(next);
    setPage(1);
    if (next.type === "all") {
      setSearchInput("");
      setSearchQuery("");
    } else {
      setSearchInput(next.label);
      setSearchQuery("");
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (selection.type !== "all") {
      setSelection({ type: "all" });
    }
  }

  function handleSearchClear() {
    setSearchInput("");
    setSearchQuery("");
    setSelection({ type: "all" });
    setPage(1);
  }

  function handleSearchSelectProduct(product: ReviewFilterProduct) {
    setSelection({
      type: "product",
      id: product.id,
      label: product.title,
    });
    setSearchInput(product.title);
    setSearchQuery("");
    setPage(1);
  }

  function handleSearchSelectCategory(category: ReviewFilterCategory) {
    setSelection({
      type: "category",
      id: category.id,
      label: category.name,
    });
    setSearchInput(category.name);
    setSearchQuery("");
    setPage(1);
  }

  const showSearchClear =
    searchInput.length > 0 ||
    searchQuery.length > 0 ||
    selection.type !== "all";

  return (
    <main className={`${HOME_CONTAINER_CLS} reviews-page py-10 md:py-12`}>
      <ReviewsHeroPanel totalReviews={totalPublishedReviews} />

      <div className="reviews-page-layout">
        <ReviewsFilterSidebar
          filters={filterData}
          selection={selection}
          onSelect={handleFilterSelect}
          loading={filtersLoading}
        />

        <div className="reviews-page-main">
          <div className="reviews-page-toolbar">
            <ReviewsSearchBox
              filters={filterData}
              value={searchInput}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              onSelectProduct={handleSearchSelectProduct}
              onSelectCategory={handleSearchSelectCategory}
              showClear={showSearchClear}
            />
          </div>

          {isLoading && !data ? <ReviewsListingSkeleton /> : null}

          {isError ? (
            <div className="reviews-page-empty">
              <p>
                Could not load reviews. Make sure the API server is running (
                <code className="text-xs">pnpm dev:api</code>).
              </p>
              <button
                type="button"
                className="btn-secondary btn-secondary-sm"
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {!isLoading && !isError && data?.items.length === 0 ? (
            <div className="reviews-page-empty">
              <p>
                {searchQuery
                  ? `No reviews found for product or category "${searchQuery}".`
                  : activeFilterLabel
                    ? `No reviews for ${activeFilterLabel} yet.`
                    : "No published reviews yet."}
              </p>
            </div>
          ) : null}

          {!isError && data && data.items.length > 0 ? (
            <>
              <p className="reviews-page-count">
                {data.total} review{data.total === 1 ? "" : "s"}
                {activeFilterLabel ? ` for ${activeFilterLabel}` : ""}
                {searchQuery ? ` matching product or category "${searchQuery}"` : ""}
              </p>
              <div className="reviews-page-list" aria-live="polite">
                {data.items.map((review) => (
                  <ReviewListCard key={review._id} review={review} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="blog-pagination" aria-label="Reviews pagination">
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
