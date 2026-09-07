"use client";

import { StarIcon } from "@/components/admin/icons";
import {
  type ProductReviewsSummary,
  type PublicProductReview,
  type SubmittedProductReview,
} from "@/lib/api";
import { ProductDetailReviewForm } from "@/components/product/ProductDetailReviewForm";

type Props = {
  productId: string;
  reviews: PublicProductReview[];
  reviewsLoading: boolean;
  reviewsLoaded: boolean;
  reviewAvg: number;
  reviewCount: number;
  reviewSummary: ProductReviewsSummary;
  reviewsPage: number;
  reviewsTotal: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onReviewSubmitted: (review: SubmittedProductReview) => void;
  id?: string;
  "aria-labelledby"?: string;
};

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

function ReviewStars({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const rounded = Math.round(rating);
  return (
    <span
      className={`product-pdp-review-stars-display product-pdp-review-stars-display--${size}`}
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
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

function ReviewSummary({
  reviewAvg,
  reviewCount,
  distribution,
}: {
  reviewAvg: number;
  reviewCount: number;
  distribution: number[];
}) {
  const maxCount = Math.max(...distribution, 1);

  return (
    <div className="product-pdp-review-summary">
      <div className="product-pdp-review-summary-score">
        <p className="product-pdp-review-summary-value">
          {reviewCount > 0 ? reviewAvg.toFixed(1) : "—"}
        </p>
        <ReviewStars rating={reviewAvg} size="md" />
        <p className="product-pdp-review-summary-meta">
          Based on {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="product-pdp-review-summary-bars" aria-hidden={reviewCount === 0}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1] ?? 0;
          const width = reviewCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={star} className="product-pdp-review-bar-row">
              <span className="product-pdp-review-bar-label">{star}</span>
              <span className="product-pdp-review-bar-track">
                <span
                  className="product-pdp-review-bar-fill"
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="product-pdp-review-bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: PublicProductReview }) {
  return (
    <article className="product-pdp-review-card">
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

function reviewRangeLabel(page: number, pageSize: number, total: number) {
  if (total === 0) return "No reviews";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `Showing ${start}–${end} of ${total}`;
}

export function ProductDetailReviewsPanel({
  productId,
  reviews,
  reviewsLoading,
  reviewsLoaded,
  reviewAvg,
  reviewCount,
  reviewSummary,
  reviewsPage,
  reviewsTotal,
  pageSize,
  onPageChange,
  onReviewSubmitted,
  id,
  "aria-labelledby": ariaLabelledby,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(reviewsTotal / pageSize));
  const hasPrev = reviewsPage > 1;
  const hasNext = reviewsPage < totalPages;

  return (
    <div
      id={id}
      className="product-pdp-reviews"
      role="tabpanel"
      aria-labelledby={ariaLabelledby}
      tabIndex={0}
    >
      <div className="product-pdp-reviews-header">
        <div className="min-w-0">
          <p className="product-pdp-reviews-kicker">Reviews</p>
          <h2 className="product-pdp-reviews-title">Customer reviews</h2>
        </div>
        {reviewCount > 0 ? (
          <span className="product-pdp-reviews-count-badge">
            {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ReviewSummary
        reviewAvg={reviewAvg}
        reviewCount={reviewCount}
        distribution={reviewSummary.distribution}
      />

      <section className="product-pdp-review-compose" aria-label="Write a review">
        <div className="product-pdp-review-compose-head">
          <p className="product-pdp-review-compose-kicker">Your feedback</p>
          <p className="product-pdp-review-compose-title">Write a review</p>
        </div>
        <ProductDetailReviewForm
          productId={productId}
          onSubmitted={onReviewSubmitted}
        />
      </section>

      <section className="product-pdp-review-feed" aria-label="Customer review list">
        <div className="product-pdp-review-feed-head">
          <p className="product-pdp-review-feed-title">All reviews</p>
          {reviewsTotal > 0 ? (
            <p className="product-pdp-review-feed-meta">
              {reviewRangeLabel(reviewsPage, pageSize, reviewsTotal)}
            </p>
          ) : null}
        </div>

        {reviewsLoading ? (
          <div className="product-pdp-review-loading">
            <span className="product-pdp-review-loading-dot" aria-hidden />
            Loading reviews…
          </div>
        ) : reviews.length > 0 ? (
          <>
            <div className="product-pdp-review-list">
              {reviews.map((review) => (
                <ReviewCard key={review._id} review={review} />
              ))}
            </div>

            {reviewsTotal > pageSize ? (
              <nav
                className="product-pdp-review-pagination"
                aria-label="Review pages"
              >
                <button
                  type="button"
                  className="dashboard-pro-btn-ghost product-pdp-review-page-btn disabled:opacity-40"
                  disabled={!hasPrev || reviewsLoading}
                  onClick={() => onPageChange(reviewsPage - 1)}
                >
                  Previous
                </button>
                <span className="product-pdp-review-page-status">
                  Page {reviewsPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="dashboard-pro-btn product-pdp-review-page-btn disabled:opacity-40"
                  disabled={!hasNext || reviewsLoading}
                  onClick={() => onPageChange(reviewsPage + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        ) : reviewsLoaded ? (
          <div className="product-pdp-review-empty">
            <span className="product-pdp-review-empty-icon" aria-hidden>
              <StarIcon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="product-pdp-review-empty-title">No reviews yet</p>
            <p className="product-pdp-review-empty-copy">
              Purchase this product and share your experience to help other buyers.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
