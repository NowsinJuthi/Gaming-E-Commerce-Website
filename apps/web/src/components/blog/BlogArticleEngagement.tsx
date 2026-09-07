"use client";

import { useEffect, useState } from "react";
import {
  fetchBlogReviews,
  type BlogReviewsSummary,
  type PublicBlogReview,
  type SubmittedBlogReview,
} from "@/lib/api";
import { BlogArticleReactions } from "@/components/blog/BlogArticleReactions";
import { BlogArticleReviewForm } from "@/components/blog/BlogArticleReviewForm";
import type { BlogPageFeatures } from "@/lib/blog-page-settings";
import { DEFAULT_BLOG_PAGE_FEATURES } from "@/lib/blog-page-settings";

const REVIEWS_INITIAL_COUNT = 5;
const REVIEWS_LOAD_MORE_COUNT = 5;

type Props = {
  slug: string;
  likeCount?: number;
  dislikeCount?: number;
  features?: BlogPageFeatures;
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

function ReviewStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="blog-article-review-stars-display"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={
            index < rounded
              ? "blog-article-review-star blog-article-review-star--filled"
              : "blog-article-review-star"
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
    <div className="blog-article-review-summary">
      <div className="blog-article-review-summary-score">
        <p className="blog-article-review-summary-value">
          {reviewCount > 0 ? reviewAvg.toFixed(1) : "—"}
        </p>
        <ReviewStars rating={reviewAvg} />
        <p className="blog-article-review-summary-meta">
          Based on {reviewCount} reader review{reviewCount === 1 ? "" : "s"}
        </p>
      </div>

      <div
        className="blog-article-review-summary-bars"
        aria-hidden={reviewCount === 0}
      >
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1] ?? 0;
          const width = reviewCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={star} className="blog-article-review-bar-row">
              <span className="blog-article-review-bar-label">{star}</span>
              <span className="blog-article-review-bar-track">
                <span
                  className="blog-article-review-bar-fill"
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="blog-article-review-bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: PublicBlogReview }) {
  return (
    <article className="blog-article-review-card">
      <div className="blog-article-review-card-head">
        <div className="blog-article-review-author">
          <span className="blog-article-review-avatar" aria-hidden>
            {customerInitial(review.customerName)}
          </span>
          <div className="min-w-0">
            <p className="blog-article-review-author-name">{review.customerName}</p>
            <div className="blog-article-review-author-meta">
              <ReviewStars rating={review.rating} />
              <span>{formatReviewDate(review.createdAt)}</span>
            </div>
          </div>
        </div>
        <span className="blog-article-review-rating-badge">{review.rating}.0</span>
      </div>

      <div className="blog-article-review-card-body">
        {review.title ? (
          <p className="blog-article-review-title">{review.title}</p>
        ) : null}
        <p className="blog-article-review-text">{review.body}</p>
      </div>

      {review.adminReply?.trim() ? (
        <div className="blog-article-review-reply">
          <p className="blog-article-review-reply-label">
            {review.adminReplyAuthor?.trim() || "UniQbd"} response
          </p>
          <p className="blog-article-review-reply-text">{review.adminReply}</p>
        </div>
      ) : null}
    </article>
  );
}

export function BlogArticleEngagement({
  slug,
  likeCount = 0,
  dislikeCount = 0,
  features = DEFAULT_BLOG_PAGE_FEATURES,
}: Props) {
  const [reviews, setReviews] = useState<PublicBlogReview[]>([]);
  const [summary, setSummary] = useState<BlogReviewsSummary>({
    avg: 0,
    count: 0,
    distribution: [0, 0, 0, 0, 0],
  });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!features.reviewsEnabled) {
      setReviewsLoading(false);
      setReviewsLoaded(true);
      return;
    }

    let cancelled = false;
    setReviewsLoading(true);
    setPage(1);
    fetchBlogReviews(slug, 1, REVIEWS_INITIAL_COUNT)
      .then((data) => {
        if (cancelled) return;
        setReviews(data.items);
        setSummary(data.summary);
        setTotal(data.total);
        setReviewsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setReviews([]);
          setReviewsLoaded(true);
        }
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, features.reviewsEnabled]);

  async function loadMoreReviews() {
    if (loadingMore || reviews.length >= total) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchBlogReviews(
        slug,
        nextPage,
        REVIEWS_LOAD_MORE_COUNT,
      );
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id));
        const appended = data.items.filter((review) => !seen.has(review.id));
        return [...current, ...appended];
      });
      setSummary(data.summary);
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleReviewSubmitted(review: SubmittedBlogReview) {
    setReviews((current) => [review, ...current]);
    setSummary((current) => {
      const nextCount = current.count + 1;
      const nextDistribution = [...current.distribution];
      const index = Math.min(Math.max(review.rating, 1), 5) - 1;
      nextDistribution[index] = (nextDistribution[index] ?? 0) + 1;
      const totalStars =
        nextDistribution.reduce(
          (sum, count, starIndex) => sum + count * (starIndex + 1),
          0,
        ) ?? 0;
      return {
        count: nextCount,
        distribution: nextDistribution,
        avg: nextCount > 0 ? Math.round((totalStars / nextCount) * 10) / 10 : 0,
      };
    });
    setTotal((value) => value + 1);
  }

  const hasMoreReviews = reviews.length < total;
  const remainingReviews = Math.max(0, total - reviews.length);

  if (!features.reactionsEnabled && !features.reviewsEnabled) {
    return null;
  }

  return (
    <section className="blog-article-engagement" aria-label="Article feedback">
      {features.reactionsEnabled ? (
        <BlogArticleReactions
          slug={slug}
          initialLikeCount={likeCount}
          initialDislikeCount={dislikeCount}
        />
      ) : null}

      {features.reactionsEnabled && features.reviewsEnabled ? (
        <div className="blog-article-engagement__divider" aria-hidden />
      ) : null}

      {features.reviewsEnabled ? (
      <div className="blog-article-reviews">
        <div className="blog-article-reviews-header">
          <div>
            <p className="blog-article-reviews-kicker">Reader feedback</p>
            <h2 className="blog-article-reviews-title">Reviews</h2>
          </div>
          <span className="blog-article-reviews-count-badge">
            {summary.count} review{summary.count === 1 ? "" : "s"}
          </span>
        </div>

        <ReviewSummary
          reviewAvg={summary.avg}
          reviewCount={summary.count}
          distribution={summary.distribution}
        />

        <div className="blog-article-review-compose">
          <p className="blog-article-review-compose-kicker">Share your thoughts</p>
          <h3 className="blog-article-review-compose-title">Write a review</h3>
          <BlogArticleReviewForm
            slug={slug}
            onSubmitted={handleReviewSubmitted}
          />
        </div>

        <div className="blog-article-review-feed">
          <h3 className="blog-article-review-feed-title">Recent reviews</h3>

          {reviewsLoading && !reviewsLoaded ? (
            <p className="blog-article-review-feed-loading">Loading reviews…</p>
          ) : null}

          {!reviewsLoading && reviews.length === 0 ? (
            <p className="blog-article-review-feed-empty">
              No reviews yet. Be the first to share your thoughts.
            </p>
          ) : null}

          {reviews.length > 0 ? (
            <div className="blog-article-review-feed-list">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : null}

          {hasMoreReviews ? (
            <div className="blog-article-review-see-more-wrap">
              <button
                type="button"
                className="blog-article-review-see-more btn-secondary btn-secondary-sm"
                disabled={loadingMore}
                onClick={() => void loadMoreReviews()}
              >
                {loadingMore
                  ? "Loading…"
                  : `See more reviews (${remainingReviews} remaining)`}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      ) : null}
    </section>
  );
}
