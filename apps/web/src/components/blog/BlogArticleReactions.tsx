"use client";
import { hasAuthSession } from "@/lib/access-token";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchMyBlogReaction,
  setBlogReaction,
  type BlogReactionType,
} from "@/lib/api";

function ThumbUpIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "1.8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbDownIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "1.8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

type Props = {
  slug: string;
  initialLikeCount?: number;
  initialDislikeCount?: number;
};

export function BlogArticleReactions({
  slug,
  initialLikeCount = 0,
  initialDislikeCount = 0,
}: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [reaction, setReaction] = useState<BlogReactionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncAuth = useCallback(() => {
    setIsLoggedIn(hasAuthSession());
  }, []);

  useEffect(() => {
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, [syncAuth]);

  useEffect(() => {
    if (!isLoggedIn) {
      setReaction(null);
      return;
    }

    let cancelled = false;
    fetchMyBlogReaction(slug)
      .then((result) => {
        if (!cancelled) setReaction(result.reaction);
      })
      .catch(() => {
        if (!cancelled) setReaction(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, slug]);

  async function handleReaction(type: BlogReactionType) {
    if (!isLoggedIn) return;
    setError(null);
    setLoading(true);
    try {
      const result = await setBlogReaction(slug, type);
      setLikeCount(result.likeCount);
      setDislikeCount(result.dislikeCount);
      setReaction(result.reaction ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to update reaction");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="blog-article-reactions">
      <p className="blog-article-reactions__label">Was this article helpful?</p>

      <div className="blog-article-reactions__actions">
        <button
          type="button"
          className={`blog-article-reactions__btn blog-article-reactions__btn--like${
            reaction === "like" ? " blog-article-reactions__btn--active" : ""
          }`}
          onClick={() => handleReaction("like")}
          disabled={!isLoggedIn || loading}
          aria-pressed={reaction === "like"}
        >
          <span className="blog-article-reactions__icon-wrap" aria-hidden>
            <ThumbUpIcon
              className="blog-article-reactions__icon"
              filled={reaction === "like"}
            />
          </span>
          <span className="blog-article-reactions__text">Like</span>
          <span className="blog-article-reactions__count">{likeCount}</span>
        </button>

        <button
          type="button"
          className={`blog-article-reactions__btn blog-article-reactions__btn--dislike${
            reaction === "dislike" ? " blog-article-reactions__btn--active" : ""
          }`}
          onClick={() => handleReaction("dislike")}
          disabled={!isLoggedIn || loading}
          aria-pressed={reaction === "dislike"}
        >
          <span className="blog-article-reactions__icon-wrap" aria-hidden>
            <ThumbDownIcon
              className="blog-article-reactions__icon"
              filled={reaction === "dislike"}
            />
          </span>
          <span className="blog-article-reactions__text">Dislike</span>
          <span className="blog-article-reactions__count">{dislikeCount}</span>
        </button>
      </div>

      {!isLoggedIn ? (
        <p className="blog-article-reactions__hint">
          <Link href="/login" className="blog-article-reactions__link">
            Sign in
          </Link>{" "}
          to like or dislike this article.
        </p>
      ) : null}

      {error ? <p className="blog-article-reactions__error">{error}</p> : null}
    </div>
  );
}
