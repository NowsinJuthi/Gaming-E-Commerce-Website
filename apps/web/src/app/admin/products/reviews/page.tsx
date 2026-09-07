"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { ChatIcon, CheckIcon, PulseIcon, SearchIcon, StarIcon, ZapIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  adminListReviews,
  deleteReview,
  updateReview,
  type ProductReview,
  type ReviewStatusValue,
} from "@/lib/api";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type StatusFilter = "" | ReviewStatusValue;
type RatingFilter = "" | "1" | "2" | "3" | "4" | "5";

type ReviewDraft = {
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string;
  body: string;
  adminReply: string;
  status: ReviewStatusValue;
  createdAt: string;
};

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  if (!value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function reviewToDraft(review: ProductReview): ReviewDraft {
  return {
    customerName: review.customerName,
    customerEmail: review.customerEmail ?? "",
    rating: review.rating,
    title: review.title ?? "",
    body: review.body,
    adminReply: review.adminReply ?? "",
    status: review.status,
    createdAt: review.createdAt,
  };
}

function draftToPatch(
  draft: ReviewDraft,
  status?: ReviewStatusValue,
): {
  customerName: string;
  customerEmail?: string;
  rating: number;
  title?: string;
  body: string;
  status: ReviewStatusValue;
  adminReply?: string;
  createdAt: string;
} {
  return {
    customerName: draft.customerName.trim(),
    customerEmail: draft.customerEmail.trim() || undefined,
    rating: draft.rating,
    title: draft.title.trim() || undefined,
    body: draft.body.trim(),
    status: status ?? draft.status,
    adminReply: draft.adminReply.trim() || undefined,
    createdAt: draft.createdAt,
  };
}

const STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  published: "dashboard-pro-status dashboard-pro-status--green",
  rejected:
    "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted",
  flagged:
    "dashboard-pro-status border border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  published: "Published",
  rejected: "Rejected",
  flagged: "Flagged",
};

function formatStatus(status: string) {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

function formatReviewDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncateExcerpt(text: string, max = 88) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function customerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function countReviewStats(items: ProductReview[]) {
  let pending = 0;
  let published = 0;
  let flagged = 0;
  let rejected = 0;
  let withReply = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  for (const review of items) {
    const status = review.status ?? "pending";
    if (status === "pending") pending += 1;
    if (status === "published") {
      published += 1;
      ratingSum += review.rating;
      ratingCount += 1;
    }
    if (status === "flagged") flagged += 1;
    if (status === "rejected") rejected += 1;
    if (review.adminReply?.trim()) withReply += 1;
  }
  return {
    total: items.length,
    pending,
    published,
    flagged,
    rejected,
    withReply,
    avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
  };
}

type ReviewStatTone = "brand" | "success" | "amber" | "muted";

function reviewOverviewStatClass(tone: ReviewStatTone, active = false) {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "w-full text-left",
    active ? "customer-dashboard-overview-stat--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function Stars({
  rating,
  className = "",
  showValue = false,
}: {
  rating: number;
  className?: string;
  showValue?: boolean;
}) {
  return (
    <span className={`admin-reviews-stars ${className}`.trim()}>
      <span
        className="inline-flex items-center gap-0.5"
        aria-label={`${rating} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon
            key={i}
            className={`admin-reviews-star h-3.5 w-3.5 ${
              i < rating ? "admin-reviews-star--filled" : ""
            }`}
          />
        ))}
      </span>
      {showValue ? (
        <span className="admin-reviews-stars__value">{rating}/5</span>
      ) : null}
    </span>
  );
}

type ReviewQueueMobileCardProps = {
  review: ProductReview;
  isSelected: boolean;
  checked: boolean;
  excerpt: string;
  onSelect: (review: ProductReview) => void;
  onToggleChecked: (id: string) => void;
};

function ReviewQueueMobileCard({
  review,
  isSelected,
  checked,
  excerpt,
  onSelect,
  onToggleChecked,
}: ReviewQueueMobileCardProps) {
  return (
    <article
      className={`admin-reviews-queue-card${isSelected ? " is-selected" : ""}`}
    >
      <div className="admin-reviews-queue-card__head">
        <div className="admin-reviews-queue-card__customer">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleChecked(review._id)}
            aria-label={`Select review from ${review.customerName}`}
            className="admin-reviews-queue-card__checkbox rounded border-border-strong"
          />
          <span
            className="admin-reviews-customer-avatar grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xs font-semibold text-brand"
            aria-hidden
          >
            {customerInitial(review.customerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {review.customerName}
            </p>
            {review.customerEmail ? (
              <p className="truncate text-xs text-subtle">
                {review.customerEmail}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={
            STATUS_STYLE[review.status] ?? STATUS_STYLE.pending
          }
        >
          {formatStatus(review.status)}
        </span>
      </div>

      <div className="admin-reviews-queue-card__product">
        <p className="truncate font-medium text-foreground">
          {review.productTitle}
        </p>
        {review.productSlug ? (
          <p className="truncate text-xs text-subtle">/{review.productSlug}</p>
        ) : null}
      </div>

      <p className="admin-reviews-queue-card__excerpt">{excerpt}</p>

      <div className="admin-reviews-queue-card__meta">
        <Stars rating={review.rating} showValue />
        <span>{formatReviewDate(review.createdAt)}</span>
        {review.adminReply?.trim() ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            Store reply
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onSelect(review)}
        className={`admin-reviews-queue-card__manage${
          isSelected ? " is-selected" : ""
        }`}
      >
        {isSelected ? "Selected" : "Manage review"}
      </button>
    </article>
  );
}

type ReviewQueuePaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

function ReviewQueuePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: ReviewQueuePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="admin-reviews-queue-pagination">
      <p className="admin-reviews-queue-pagination__summary">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {(currentPage - 1) * pageSize + 1}–
          {Math.min(currentPage * pageSize, totalItems)}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-foreground">{totalItems}</span>{" "}
        reviews
      </p>
      <div className="admin-reviews-queue-pagination__controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="dashboard-pro-btn-ghost text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <span className="admin-reviews-queue-pagination__label sm:hidden">
          Page {currentPage} of {totalPages}
        </span>
        <div className="hidden items-center gap-1.5 sm:flex">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === currentPage ? "page" : undefined}
              className={`grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-xs font-semibold transition ${
                n === currentPage
                  ? "bg-brand/15 text-brand ring-1 ring-brand/40"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="dashboard-pro-btn-ghost text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("");
  const [selected, setSelected] = useState<ProductReview | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  
  const filtersActive = Boolean(search.trim() || statusFilter || ratingFilter);

  const filteredReviews = useMemo(
    () =>
      [...reviews].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [reviews],
  );

  const hasReviews = reviews.length > 0;
  const isOnboarding = !loading && !hasReviews && !filtersActive;

  const stats = useMemo(() => countReviewStats(reviews), [reviews]);
  const pendingCount = stats.pending;

  const loadReviews = useCallback(
    async (opts?: { silent?: boolean; isCancelled?: () => boolean }) => {
      const stale = () => opts?.isCancelled?.() ?? false;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const items = await adminListReviews({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          rating: ratingFilter ? Number(ratingFilter) : undefined,
        });
        if (!stale()) setReviews(items);
      } catch {
        if (!stale()) {
          if (!opts?.silent) setReviews([]);
          setError("Could not load reviews.");
        }
      } finally {
        if (!stale() && !opts?.silent) setLoading(false);
      }
    },
    [search, statusFilter, ratingFilter],
  );

  useEffect(() => {
    let cancelled = false;
    const delay = search.trim() ? 300 : 0;
    const timer = window.setTimeout(() => {
      void loadReviews({ isCancelled: () => cancelled });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadReviews, search]);

  useEffect(() => {
    if (selected && !reviews.some((r) => r._id === selected._id)) {
      setSelected(null);
      setDraft(null);
    }
  }, [reviews, selected]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(reviewToDraft(selected));
  }, [selected]);

  function clearSelection() {
    setSelected(null);
    setDraft(null);
  }

  // Close the edit popup with Escape and lock page scroll while it's open.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setRatingFilter("");
  }

  function selectReview(review: ProductReview) {
    setSelected(review);
    setError(null);
    hideAdminToast();
  }

  async function patchReview(
    id: string,
    patch: {
      customerName?: string;
      customerEmail?: string;
      rating?: number;
      title?: string;
      body?: string;
      status?: ReviewStatusValue;
      adminReply?: string;
      createdAt?: string;
    },
    successText: string,
  ) {
    setSaving(true);
    setError(null);
    hideAdminToast();
    try {
      const updated = await updateReview(id, patch);
      adminToast(successText, true);
      setSelected((current) => (current?._id === id ? updated : current));
      setDraft(reviewToDraft(updated));
      await loadReviews({ silent: true });
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not update review", false);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !draft) return;

    const customerName = draft.customerName.trim();
    const body = draft.body.trim();
    if (!customerName) {
      setError("Customer name is required.");
      return;
    }
    if (!body) {
      setError("Review text is required.");
      return;
    }
    if (!draft.createdAt) {
      setError("Submitted date is required.");
      return;
    }

    await patchReview(selected._id, draftToPatch(draft), "Review updated.");
  }

  async function onDelete(id: string, customerName: string) {
    if (!confirm(`Delete review from "${customerName}"?`)) return;
    setDeletingId(id);
    hideAdminToast();
    try {
      await deleteReview(id);
      adminToast("Review deleted.", true);
      if (selected?._id === id) clearSelection();
      setCheckedIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadReviews({ silent: true });
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not delete review", false);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    setCheckedIds((current) => {
      const next = new Set(current);
      const pageIds = pagedReviews.map((review) => review._id);
      const allOnPage = pageIds.every((id) => next.has(id));
      if (allOnPage) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function onDeleteChecked() {
    const ids = filteredReviews
      .filter((review) => checkedIds.has(review._id))
      .map((review) => review._id);
    if (ids.length === 0 || bulkDeleting) return;
    if (
      !confirm(
        `Delete ${ids.length} selected review${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    hideAdminToast();
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deleteReview(id)),
      );
      const deleted = new Set(
        ids.filter((_, i) => results[i]?.status === "fulfilled"),
      );
      const failed = ids.length - deleted.size;
      setCheckedIds(new Set());
      if (selected && deleted.has(selected._id)) clearSelection();
      if (failed > 0) {
        adminToast(
          `Deleted ${deleted.size}, but ${failed} review${failed === 1 ? "" : "s"} could not be deleted`,
          false,
        );
      } else {
        adminToast(
          `${deleted.size} review${deleted.size === 1 ? "" : "s"} deleted.`,
          true,
        );
      }
      await loadReviews({ silent: true });
    } finally {
      setBulkDeleting(false);
    }
  }

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedReviews = filteredReviews.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, ratingFilter]);

  const checkedCount = filteredReviews.filter((review) =>
    checkedIds.has(review._id),
  ).length;
  const allChecked =
    pagedReviews.length > 0 &&
    pagedReviews.every((review) => checkedIds.has(review._id));

  const reviewDetailPanel =
    selected && draft ? (
    <ProductFormOrderCard
      className="admin-product-form-section admin-reviews-detail ring-1 ring-brand/30"
      icon={<ChatIcon className="h-4 w-4" />}
      title={draft.customerName || selected.customerName}
      subtitle="Edit review content, moderate status, and publish store replies."
      action={
        <button
          type="button"
          onClick={clearSelection}
          className="dashboard-pro-btn-ghost shrink-0 text-xs"
        >
          Close
        </button>
      }
    >
      <form onSubmit={onSaveReview} className="space-y-0">
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Customer</dt>
          <dd className="admin-product-form-sidebar-fields space-y-3">
            <div className="flex items-start gap-3">
              <span
                className="admin-reviews-customer-avatar grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-semibold text-brand"
                aria-hidden
              >
                {customerInitial(draft.customerName)}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className={labelCls} htmlFor="review-customer-name">
                    Customer name
                  </label>
                  <input
                    id="review-customer-name"
                    value={draft.customerName}
                    onChange={(e) =>
                      setDraft((current) =>
                        current
                          ? { ...current, customerName: e.target.value }
                          : current,
                      )
                    }
                    className={inputCls}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="review-customer-email">
                    Customer email
                  </label>
                  <input
                    id="review-customer-email"
                    type="email"
                    value={draft.customerEmail}
                    onChange={(e) =>
                      setDraft((current) =>
                        current
                          ? { ...current, customerEmail: e.target.value }
                          : current,
                      )
                    }
                    className={inputCls}
                    maxLength={160}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="review-rating">
                    Rating
                  </label>
                  <select
                    id="review-rating"
                    value={draft.rating}
                    onChange={(e) =>
                      setDraft((current) =>
                        current
                          ? { ...current, rating: Number(e.target.value) }
                          : current,
                      )
                    }
                    className="admin-select w-full"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} star{value === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="review-created-at">
                    Submitted date & time
                  </label>
                  <input
                    id="review-created-at"
                    type="datetime-local"
                    value={toDatetimeLocalValue(draft.createdAt)}
                    onChange={(e) => {
                      const createdAt = fromDatetimeLocalValue(e.target.value);
                      setDraft((current) =>
                        current && createdAt
                          ? { ...current, createdAt }
                          : current,
                      );
                    }}
                    className={inputCls}
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/products/${selected.productId}/edit`}
                    className="dashboard-pro-quick-link inline-flex"
                  >
                    Edit product
                  </Link>
                  {selected.productSlug ? (
                    <Link
                      href={`/${selected.productSlug}`}
                      className="dashboard-pro-quick-link inline-flex"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on store
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Product</dt>
          <dd className="admin-product-form-sidebar-fields">
            <p className="text-sm font-medium text-foreground">
              {selected.productTitle}
            </p>
            {selected.productSlug ? (
              <p className="text-xs text-subtle">/{selected.productSlug}</p>
            ) : null}
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Customer review</dt>
          <dd className="admin-product-form-sidebar-fields space-y-3">
            <div>
              <label className={labelCls} htmlFor="review-status">
                Status
              </label>
              <select
                id="review-status"
                value={draft.status}
                onChange={(e) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          status: e.target.value as ReviewStatusValue,
                        }
                      : current,
                  )
                }
                className="admin-select w-full"
              >
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="review-title">
                Headline
              </label>
              <input
                id="review-title"
                value={draft.title}
                onChange={(e) =>
                  setDraft((current) =>
                    current ? { ...current, title: e.target.value } : current,
                  )
                }
                className={inputCls}
                maxLength={200}
                placeholder="Optional headline"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="review-body">
                Review text
              </label>
              <textarea
                id="review-body"
                rows={5}
                value={draft.body}
                onChange={(e) =>
                  setDraft((current) =>
                    current ? { ...current, body: e.target.value } : current,
                  )
                }
                className={inputCls}
                maxLength={4000}
                required
              />
            </div>
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>
            Store reply
            <span className="ml-2 text-xs font-normal text-subtle">
              {draft.adminReply.trim().length}/2000
            </span>
          </dt>
          <dd className="admin-product-form-sidebar-fields space-y-3">
            <textarea
              id="review-admin-reply"
              rows={4}
              maxLength={2000}
              value={draft.adminReply}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, adminReply: e.target.value } : current,
                )
              }
              placeholder="Public reply shown with this review…"
              className={inputCls}
            />
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Moderation</dt>
          <dd className="admin-product-form-sidebar-fields space-y-3">
            <div className="flex flex-wrap gap-2">
              {draft.status !== "published" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft((current) =>
                      current ? { ...current, status: "published" } : current,
                    );
                  }}
                  className="btn-primary btn-primary-sm disabled:opacity-50"
                >
                  Set published
                </button>
              ) : null}
              {draft.status !== "rejected" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft((current) =>
                      current ? { ...current, status: "rejected" } : current,
                    );
                  }}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Set rejected
                </button>
              ) : null}
              {draft.status !== "flagged" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft((current) =>
                      current ? { ...current, status: "flagged" } : current,
                    );
                  }}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Set flagged
                </button>
              ) : null}
              <button
                type="button"
                disabled={deletingId === selected._id}
                onClick={() => void onDelete(selected._id, draft.customerName)}
                className="dashboard-pro-btn-ghost text-xs text-rose-300"
              >
                {deletingId === selected._id ? "Deleting…" : "Delete"}
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/35 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {draft.status !== "published" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void patchReview(
                      selected._id,
                      draftToPatch(draft, "published"),
                      "Review published.",
                    )
                  }
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Save & publish
                </button>
              ) : null}
            </div>
          </dd>
        </div>
      </form>
    </ProductFormOrderCard>
  ) : null;

  return (
    <AdminPageLayout
      section="Catalog"
      title="Customer reviews"
      description="Moderate product feedback, publish replies, and keep storefront ratings trustworthy."
      icon={ChatIcon}
      backHref="/admin/products"
      backLabel="Products"
      action={
        hasReviews && !loading && pendingCount > 0 && !selected ? (
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className="btn-primary btn-primary-sm"
          >
            View pending ({pendingCount})
          </button>
        ) : null
      }
    >
      {error ? (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="admin-reviews-layout space-y-5">
        <section
          className="customer-dashboard-overview-section admin-reviews-overview"
          aria-label="Review overview"
        >
          <dl className="customer-dashboard-overview-stats">
            <div className={reviewOverviewStatClass("brand")}>
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <ChatIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Total</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {stats.total}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {filtersActive
                    ? "Matching current filters"
                    : stats.avgRating > 0
                      ? `Avg ${stats.avgRating.toFixed(1)} / 5 published`
                      : "All customer feedback"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-pressed={statusFilter === "pending"}
              onClick={() =>
                setStatusFilter(statusFilter === "pending" ? "" : "pending")
              }
              className={reviewOverviewStatClass(
                "amber",
                statusFilter === "pending",
              )}
            >
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <PulseIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  Pending
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {stats.pending}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  Awaiting moderation
                </p>
              </div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "published"}
              onClick={() =>
                setStatusFilter(statusFilter === "published" ? "" : "published")
              }
              className={reviewOverviewStatClass(
                "success",
                statusFilter === "published",
              )}
            >
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <CheckIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  Published
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {stats.published}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {stats.withReply} with store repl
                  {stats.withReply === 1 ? "y" : "ies"}
                </p>
              </div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "flagged"}
              onClick={() =>
                setStatusFilter(statusFilter === "flagged" ? "" : "flagged")
              }
              className={reviewOverviewStatClass(
                "amber",
                statusFilter === "flagged",
              )}
            >
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <ZapIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  Flagged
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {stats.flagged}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {stats.rejected} rejected
                </p>
              </div>
            </button>
          </dl>
        </section>

        <AdminOrderListCard
          icon={<ChatIcon className="h-4 w-4" />}
          title="Review queue"
          subtitle={
            loading
              ? "Loading reviews…"
              : filtersActive
                ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} matching filters`
                : `${reviews.length} review${reviews.length === 1 ? "" : "s"} total`
          }
          className="admin-reviews-list"
        >
            <div className="admin-products-filters-list admin-reviews-filters-list">
              <div className="admin-products-filters-row admin-reviews-filters-row">
                <div className="admin-products-filter-field min-w-0 col-span-2 sm:col-span-1">
                  <label htmlFor="reviews-search" className="admin-products-filter-label">
                    <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                    Search
                  </label>
                  <input
                    id="reviews-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Customer, product, or text…"
                    className="admin-input w-full"
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="reviews-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <select
                    id="reviews-status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="admin-select w-full"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="published">Published</option>
                    <option value="rejected">Rejected</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="reviews-rating" className="admin-products-filter-label">
                    Rating
                  </label>
                  <select
                    id="reviews-rating"
                    value={ratingFilter}
                    onChange={(e) =>
                      setRatingFilter(e.target.value as RatingFilter)
                    }
                    className="admin-select w-full"
                  >
                    <option value="">All ratings</option>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                </div>
              </div>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="dashboard-pro-btn-ghost mt-3 text-xs"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="admin-products-table-empty">Loading reviews…</div>
            ) : filteredReviews.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <ChatIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {filtersActive
                    ? "No reviews match your filters"
                    : isOnboarding
                      ? "No reviews yet"
                      : "No reviews match your filters"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try a different search term, status, or rating filter."
                    : "Published product reviews will show up here after customers leave feedback."}
                </p>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="dashboard-pro-btn-ghost mt-4 text-xs"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="admin-reviews-queue-panel">
                {checkedCount > 0 ? (
                  <div className="admin-reviews-queue-bulk mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-sunken/20 px-4 py-2.5">
                    <span className="text-xs font-semibold text-foreground">
                      {checkedCount} selected
                    </span>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setCheckedIds(new Set())}
                        disabled={bulkDeleting}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Clear selection
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteChecked()}
                        disabled={bulkDeleting}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50 sm:flex-none"
                      >
                        {bulkDeleting
                          ? "Deleting…"
                          : `Delete selected (${checkedCount})`}
                      </button>
                    </div>
                  </div>
                ) : null}

                <ul className="admin-reviews-queue-mobile lg:hidden">
                  {pagedReviews.map((review) => {
                    const isSelected = selected?._id === review._id;
                    const excerpt = truncateExcerpt(
                      review.title
                        ? `${review.title} — ${review.body}`
                        : review.body,
                      120,
                    );
                    return (
                      <li key={review._id}>
                        <ReviewQueueMobileCard
                          review={review}
                          isSelected={isSelected}
                          checked={checkedIds.has(review._id)}
                          excerpt={excerpt}
                          onSelect={selectReview}
                          onToggleChecked={toggleChecked}
                        />
                      </li>
                    );
                  })}
                </ul>

                <div className="admin-products-table-wrap panel-3d-table-wrap hidden overflow-x-auto lg:block">
                <table className="panel-3d-table admin-table--reviews w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleCheckAll}
                          aria-label="Select all reviews"
                          className="rounded border-border-strong"
                        />
                      </th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Review</th>
                      <th>Rating</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th className="text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedReviews.map((review) => {
                      const isSelected = selected?._id === review._id;
                      const excerpt = truncateExcerpt(
                        review.title
                          ? `${review.title} — ${review.body}`
                          : review.body,
                      );
                      return (
                        <tr
                          key={review._id}
                          className={`cursor-pointer text-foreground-muted ${
                            isSelected ? "bg-brand/5" : ""
                          }`}
                          onClick={() => selectReview(review)}
                        >
                          <td
                            onClick={(e) => e.stopPropagation()}
                            className="w-10"
                          >
                            <input
                              type="checkbox"
                              checked={checkedIds.has(review._id)}
                              onChange={() => toggleChecked(review._id)}
                              aria-label={`Select review from ${review.customerName}`}
                              className="rounded border-border-strong"
                            />
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span
                                className="admin-reviews-customer-avatar grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-semibold text-brand"
                                aria-hidden
                              >
                                {customerInitial(review.customerName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {review.customerName}
                                </p>
                                {review.customerEmail ? (
                                  <p className="truncate text-xs text-subtle">
                                    {review.customerEmail}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            <p className="truncate font-medium text-foreground">
                              {review.productTitle}
                            </p>
                            {review.productSlug ? (
                              <p className="truncate text-xs text-subtle">
                                /{review.productSlug}
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <p className="max-w-xs text-sm text-foreground-muted">
                              {excerpt}
                            </p>
                            {review.adminReply?.trim() ? (
                              <span className="dashboard-pro-status dashboard-pro-status--green mt-2 inline-flex">
                                Store reply
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <Stars rating={review.rating} showValue />
                          </td>
                          <td>
                            <span
                              className={
                                STATUS_STYLE[review.status] ??
                                STATUS_STYLE.pending
                              }
                            >
                              {formatStatus(review.status)}
                            </span>
                          </td>
                          <td>{formatReviewDate(review.createdAt)}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectReview(review);
                              }}
                              className="dashboard-pro-btn-ghost text-xs"
                            >
                              {isSelected ? "Selected" : "Manage"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                <ReviewQueuePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={PAGE_SIZE}
                  totalItems={filteredReviews.length}
                  onPageChange={setPage}
                />
              </div>
            )}
        </AdminOrderListCard>

        {reviewDetailPanel ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-3 py-8 sm:px-6 sm:py-12"
            role="dialog"
            aria-modal="true"
            aria-label="Edit customer review"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={clearSelection}
              aria-label="Close review editor"
            />
            <div className="relative z-10 max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-2xl">
              {reviewDetailPanel}
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageLayout>
  );
}
