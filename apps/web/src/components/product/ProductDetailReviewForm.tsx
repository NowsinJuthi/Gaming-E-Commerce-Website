"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon, PulseIcon } from "@/components/admin/icons";
import { productInputCls } from "@/components/admin/product-form";
import {
  ApiError,
  fetchReviewEligibility,
  submitProductReview,
  type ReviewEligibility,
  type SubmittedProductReview,
} from "@/lib/api";

const labelCls = "product-pdp-review-field-label";

type Props = {
  productId: string;
  onSubmitted: (review: SubmittedProductReview) => void;
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
    <div className="product-pdp-review-stars" role="group" aria-label="Rating">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const filled = star <= active;
        return (
          <button
            key={star}
            type="button"
            className={`product-pdp-review-star-btn${
              filled ? " product-pdp-review-star-btn--active" : ""
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
      <span className="product-pdp-review-star-caption">
        {active > 0 ? `${active} / 5` : "Select rating"}
      </span>
    </div>
  );
}

function PendingApprovalNotice({ fresh }: { fresh?: boolean }) {
  return (
    <div className="product-pdp-review-form-pending">
      <span className="product-pdp-review-form-pending-icon" aria-hidden>
        {fresh ? (
          <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <PulseIcon className="h-4 w-4" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0">
        <p className="product-pdp-review-form-pending-title">
          {fresh ? "Review submitted" : "Review pending approval"}
        </p>
        <p className="product-pdp-review-form-pending-copy">
          {fresh
            ? "Thank you. Your review was sent to our team and will appear publicly after admin approval."
            : "Your review is with our team. It will appear on this page once an admin publishes it."}
        </p>
      </div>
    </div>
  );
}

export function ProductDetailReviewForm({ productId, onSubmitted }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSubmitted, setPendingSubmitted] = useState(false);

  const syncAuth = useCallback(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("accessToken")));
  }, []);

  useEffect(() => {
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, [syncAuth]);

  useEffect(() => {
    if (!isLoggedIn || !productId) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligibilityLoading(true);
    fetchReviewEligibility(productId)
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
  }, [isLoggedIn, productId]);

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
      const review = await submitProductReview({
        productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
      });
      setPendingSubmitted(true);
      setEligibility({
        canReview: false,
        reason: "pending_approval",
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
      <div className="product-pdp-review-form-note">
        <p className="product-pdp-review-form-note-copy">
          Sign in after delivery to leave a verified review for this product.
        </p>
        <Link href="/login" className="dashboard-pro-btn product-pdp-review-form-cta">
          Sign in to review
        </Link>
      </div>
    );
  }

  if (eligibilityLoading) {
    return (
      <p className="product-pdp-review-form-loading">Checking review eligibility…</p>
    );
  }

  if (pendingSubmitted || eligibility?.reason === "pending_approval") {
    return <PendingApprovalNotice fresh={pendingSubmitted} />;
  }

  if (eligibility?.reason === "already_reviewed") {
    return (
      <div className="product-pdp-review-form-success">
        <span className="product-pdp-review-form-success-icon" aria-hidden>
          <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <p className="product-pdp-review-form-success-copy">
          You have already submitted a review for this product.
        </p>
      </div>
    );
  }

  if (eligibility && !eligibility.canReview) {
    if (eligibility.reason === "not_delivered") {
      return (
        <div className="product-pdp-review-form-note">
          <p className="product-pdp-review-form-note-copy">
            Reviews unlock once your order is delivered. Track progress in{" "}
            <Link href="/orders" className="product-pdp-review-inline-link">
              order history
            </Link>
            .
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <form className="product-pdp-review-form" onSubmit={handleSubmit}>
      <div className="product-pdp-review-form-grid">
        <div className="product-pdp-review-form-field product-pdp-review-form-field--full">
          <span className={labelCls}>Overall rating</span>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <div className="product-pdp-review-form-field product-pdp-review-form-field--full">
          <label className={labelCls} htmlFor="product-review-title">
            Headline
            <span className="product-pdp-review-field-optional">Optional</span>
          </label>
          <input
            id="product-review-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={productInputCls}
            placeholder="Summarize your experience in one line"
            maxLength={200}
          />
        </div>

        <div className="product-pdp-review-form-field product-pdp-review-form-field--full">
          <label className={labelCls} htmlFor="product-review-body">
            Detailed review
          </label>
          <textarea
            id="product-review-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${productInputCls} product-pdp-review-textarea`}
            placeholder="Tell buyers what worked well, what could improve, and whether you would recommend it."
            maxLength={4000}
            required
          />
          <p className="product-pdp-review-char-count">{body.trim().length}/4000</p>
        </div>
      </div>

      {error ? (
        <p className="product-pdp-review-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="product-pdp-review-form-actions">
        <button
          type="submit"
          className="dashboard-pro-btn product-pdp-review-form-cta disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}
