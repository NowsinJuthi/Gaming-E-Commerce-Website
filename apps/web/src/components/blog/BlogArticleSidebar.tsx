"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BlogCategory } from "@/lib/api";
import { getBlogPosts } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { blogCategoryPath, blogPath, blogPostPath } from "@/lib/seo";

type ListingSearch = {
  value: string;
  onSearch: (query: string) => void;
};

type Props = {
  categories: BlogCategory[];
  activeCategorySlug?: string;
  listingSearch?: ListingSearch;
  /** Article detail: mobile shows back button only (no search/categories). */
  articlePage?: boolean;
};

const SUGGEST_MIN_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 280;

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function BlogArticleSidebar({
  categories,
  activeCategorySlug,
  listingSearch,
  articlePage = false,
}: Props) {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(listingSearch?.value ?? "");
  const [debouncedDraft, setDebouncedDraft] = useState(draft);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    if (listingSearch) {
      setDraft(listingSearch.value);
    }
  }, [listingSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDraft(draft);
    }, SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const trimmedDraft = draft.trim();
  const trimmedDebounced = debouncedDraft.trim();
  const suggestEnabled =
    suggestOpen && trimmedDebounced.length >= SUGGEST_MIN_CHARS;

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.blog.list({
      q: trimmedDebounced,
      limit: 6,
      categorySlug: activeCategorySlug,
      suggest: true,
    }),
    queryFn: () =>
      getBlogPosts({
        q: trimmedDebounced,
        limit: 6,
        ...(activeCategorySlug ? { categorySlug: activeCategorySlug } : {}),
      }),
    enabled: suggestEnabled,
    staleTime: 30_000,
  });

  const suggestions = suggestionsQuery.data?.items ?? [];
  const showSuggestions =
    suggestEnabled &&
    (suggestionsQuery.isFetching || suggestions.length > 0 || suggestionsQuery.isError);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = draft.trim();
    setSuggestOpen(false);
    if (listingSearch) {
      listingSearch.onSearch(query);
      return;
    }
    if (query) {
      router.push(`${blogPath()}?q=${encodeURIComponent(query)}` as "/");
      return;
    }
    router.push(blogPath() as "/");
  }

  function applySuggestion(title: string, slug: string) {
    setDraft(title);
    setSuggestOpen(false);
    router.push(blogPostPath(slug) as "/");
  }

  const activeCategories = categories.filter(
    (category) => category.isActive !== false,
  );

  const filtersScrollRef = useRef<HTMLDivElement>(null);
  const [isMobileFilters, setIsMobileFilters] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const showCategoryScroll =
    isMobileFilters && activeCategories.length > 5;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobileFilters(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = filtersScrollRef.current;
    if (!el || !showCategoryScroll) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }

    function updateScrollState() {
      if (!el) return;
      setCanScrollUp(el.scrollTop > 4);
      setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    }

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [showCategoryScroll, activeCategories.length]);

  function scrollCategories(direction: "up" | "down") {
    const el = filtersScrollRef.current;
    if (!el) return;
    const firstItem = el.querySelector("li");
    const step =
      firstItem?.getBoundingClientRect().height ??
      (parseFloat(getComputedStyle(el).lineHeight) || 40);
    el.scrollBy({
      top: direction === "down" ? step : -step,
      behavior: "smooth",
    });
  }

  return (
    <aside
      className={`blog-sidebar${articlePage ? " blog-sidebar--article" : ""}`}
      aria-label="Blog search and filters"
    >
      <div className="blog-sidebar__panel">
        <h2 className="blog-sidebar__title">Search</h2>
        <form className="blog-sidebar__search" onSubmit={handleSubmit}>
          <div className="blog-sidebar__search-field" ref={rootRef}>
            <label htmlFor="blog-sidebar-search" className="sr-only">
              Search articles
            </label>
            <input
              id="blog-sidebar-search"
              type="search"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => {
                if (trimmedDraft.length >= SUGGEST_MIN_CHARS) {
                  setSuggestOpen(true);
                }
              }}
              placeholder="Search articles…"
              className="blog-sidebar__search-input"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? listboxId : undefined}
              aria-autocomplete="list"
              autoComplete="off"
            />

            {showSuggestions ? (
              <div className="blog-sidebar__suggestions" role="presentation">
                {suggestionsQuery.isFetching && suggestions.length === 0 ? (
                  <p className="blog-sidebar__suggestions-status">Searching…</p>
                ) : null}

                {!suggestionsQuery.isFetching && suggestions.length === 0 ? (
                  <p className="blog-sidebar__suggestions-status">
                    No matching articles
                  </p>
                ) : null}

                {suggestions.length > 0 ? (
                  <ul
                    id={listboxId}
                    className="blog-sidebar__suggestions-list"
                    role="listbox"
                    aria-label="Article suggestions"
                  >
                    {suggestions.map((post) => (
                      <li key={post.id} role="option">
                        <button
                          type="button"
                          className="blog-sidebar__suggestion"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applySuggestion(post.title, post.slug)}
                        >
                          <span className="blog-sidebar__suggestion-title">
                            {post.title}
                          </span>
                          {post.category ? (
                            <span className="blog-sidebar__suggestion-meta">
                              {post.category}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {listingSearch ? (
                  <button
                    type="button"
                    className="blog-sidebar__suggestions-all"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSuggestOpen(false);
                      listingSearch.onSearch(trimmedDraft);
                    }}
                  >
                    Search all results for &ldquo;{trimmedDraft}&rdquo;
                  </button>
                ) : (
                  <Link
                    href={
                      `${blogPath()}?q=${encodeURIComponent(trimmedDraft)}` as "/"
                    }
                    className="blog-sidebar__suggestions-all"
                    onClick={() => setSuggestOpen(false)}
                  >
                    Search all results for &ldquo;{trimmedDraft}&rdquo;
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          <button type="submit" className="blog-sidebar__search-btn">
            <SearchIcon />
            <span>Search</span>
          </button>
        </form>
      </div>

      <div className="blog-sidebar__panel blog-sidebar__panel--filters">
        <h2 className="blog-sidebar__title">Categories</h2>
        <div
          ref={filtersScrollRef}
          className={`blog-sidebar__filters-scroll${
            showCategoryScroll ? " blog-sidebar__filters-scroll--mobile" : ""
          }`}
        >
          <ul className="blog-sidebar__filters">
          <li>
            <Link
              href={blogPath() as "/"}
              className={`blog-sidebar__filter${!activeCategorySlug ? " blog-sidebar__filter--active" : ""}`}
            >
              All articles
            </Link>
          </li>
          {activeCategories.map((category) => {
            const active = activeCategorySlug === category.slug;
            return (
              <li key={category.id}>
                <Link
                  href={blogCategoryPath(category.slug) as "/"}
                  className={`blog-sidebar__filter${active ? " blog-sidebar__filter--active" : ""}`}
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
          </ul>
        </div>

        {showCategoryScroll ? (
          <div className="blog-sidebar__filters-nav" aria-label="Scroll categories">
            <button
              type="button"
              className="blog-sidebar__filters-nav-btn"
              onClick={() => scrollCategories("up")}
              disabled={!canScrollUp}
              aria-label="Scroll categories up"
            >
              <span aria-hidden>↑</span>
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="blog-sidebar__filters-nav-btn"
              onClick={() => scrollCategories("down")}
              disabled={!canScrollDown}
              aria-label="Scroll categories down"
            >
              <span>More</span>
              <span aria-hidden>↓</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
