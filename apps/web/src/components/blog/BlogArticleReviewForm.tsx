"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon } from "@/components/admin/icons";
import {
  ApiError,
  fetchBlogReviewEligibility,
  submitBlogReview,
  type BlogReviewEligibility,
  type SubmittedBlogReview,
} from "@/lib/api";

const labelCls = "blog-article-review-field-label";

type Props = {
  slug: string;
  onSubmitted: (review: SubmittedBlogReview) => void;
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="blog-article-review-stars" role="group" aria-label="Rating">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const filled = star <= active;
        return (
          <button
            key={star}
            type="button"
            className={`blog-article-review-star-btn${
              filled ? " blog-article-review-star-btn--active" : ""
            }`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={value === star}
          >
            ★
          </button>
        );
      })}
      <span className="blog-article-review-star-caption">
        {active > 0 ? `${active} / 5` : "Select rating"}
      </span>
    </div>
  );
}

export function BlogArticleReviewForm({ slug, onSubmitted }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [eligibility, setEligibility] = useState<BlogReviewEligibility | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const syncAuth = useCallback(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("accessToken")));
  }, []);

  useEffect(() => {
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, [syncAuth]);

  useEffect(() => {
    if (!isLoggedIn || !slug) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligibilityLoading(true);
    fetchBlogReviewEligibility(slug)
      .then((result) => {
        if (!cancelled) setEligibility(result);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, slug]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    if (body.trim().length < 3) {
      setError("Please write at least 3 characters in your review.");
      return;
    }

    setSubmitting(true);
    try {
      const review = await submitBlogReview(slug, {
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
      });
      setSubmitted(true);
      setEligibility({
        canReview: false,
        reason: "already_reviewed",
        status: review.status,
      });
      onSubmitted(review);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit review");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="blog-article-review-form-note">
        <p className="blog-article-review-form-note-copy">
          Sign in to share your thoughts about this article.
        </p>
        <Link href="/login" className="dashboard-pro-btn blog-article-review-form-cta">
          Sign in to review
        </Link>
      </div>
    );
  }

  if (eligibilityLoading) {
    return (
      <p className="blog-article-review-form-loading">Checking review eligibility…</p>
    );
  }

  if (submitted || eligibility?.reason === "already_reviewed") {
    return (
      <div className="blog-article-review-form-success">
        <span className="blog-article-review-form-success-icon" aria-hidden>
          <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="blog-article-review-form-success-title">Review submitted</p>
          <p className="blog-article-review-form-success-copy">
            Thank you for sharing your feedback on this article.
          </p>
        </div>
      </div>
    );
  }

  if (eligibility && !eligibility.canReview) {
    return (
      <p className="blog-article-review-form-note-copy">
        You cannot leave a review for this article right now.
      </p>
    );
  }

  return (
    <form className="blog-article-review-form" onSubmit={handleSubmit}>
      <StarPicker value={rating} onChange={setRating} />

      <div className="blog-article-review-field">
        <label htmlFor="blog-review-title" className={labelCls}>
          Title <span className="text-subtle">(optional)</span>
        </label>
        <input
          id="blog-review-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Summarize your experience"
          className="blog-article-review-input"
        />
      </div>

      <div className="blog-article-review-field">
        <label htmlFor="blog-review-body" className={labelCls}>
          Your review
        </label>
        <textarea
          id="blog-review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="What did you find helpful? What could be improved?"
          className="blog-article-review-textarea"
          required
        />
      </div>

      {error ? <p className="blog-article-review-form-error">{error}</p> : null}

      <button
        type="submit"
        className="dashboard-pro-btn blog-article-review-submit"
        disabled={submitting}
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
