"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import styles from "./media-home.module.css";
import {
  hydrateRecentCards,
  persistRecentSnapshot,
  readRecentWatched,
  syncRecentFromLegacyWatchKeys,
  watchProgressPercent,
  type RecentCardSnapshot,
} from "@/lib/media-recent-watched";
import { useLgScreen } from "@/hooks/useLgScreen";
import {
  getMediaBrowse,
  getMediaYears,
  MEDIA_PAGE_SIZE_DESKTOP,
  MEDIA_PAGE_SIZE_MOBILE,
  MEDIA_SEARCH_LIMIT,
  type MediaBrowseResult,
  type MediaCard,
  type MediaHome,
} from "@/lib/media-home-api";

type MediaDetails = {
  title: string;
  year: number;
  kind: "movie" | "series";
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  runtimeMinutes: number | null;
  rating: number | null;
  genres: string[];
  directors: string[];
  writers: string[];
  cast: { name: string; profileUrl: string | null }[];
  detailsLoaded?: boolean;
};

const ALL_LIBRARIES = "all";

type RecentWatchCard = MediaCard & {
  runtimeMinutes?: number | null;
};

function snapshotToRecentCard(snap: RecentCardSnapshot): RecentWatchCard {
  return {
    id: snap.id,
    title: snap.title,
    year: snap.year ?? 0,
    kind: snap.kind,
    posterUrl: snap.posterUrl,
    featured: false,
    trending: false,
    seasonCount: null,
    runtimeMinutes: snap.runtimeMinutes ?? null,
  };
}

function sameRecentCards(prev: RecentWatchCard[], next: RecentWatchCard[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every(
    (card, index) =>
      card.id === next[index]?.id &&
      card.title === next[index]?.title &&
      card.posterUrl === next[index]?.posterUrl &&
      card.year === next[index]?.year,
  );
}

function recentCardSnapshot(card: RecentWatchCard): RecentCardSnapshot {
  return {
    id: card.id,
    title: card.title,
    year: card.year > 0 ? card.year : null,
    kind: card.kind,
    posterUrl: card.posterUrl,
    runtimeMinutes: card.runtimeMinutes ?? null,
  };
}

export function MediaHome({
  home,
  initialBrowse,
}: {
  home: MediaHome;
  initialBrowse?: MediaBrowseResult;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLgScreen = useLgScreen();
  const pageSize = isLgScreen ? MEDIA_PAGE_SIZE_DESKTOP : MEDIA_PAGE_SIZE_MOBILE;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const lastBrowseFilterKeyRef = useRef<string | null>(
    initialBrowse?.items?.length ? `${ALL_LIBRARIES}|` : null,
  );

  const [libraryId, setLibraryId] = useState(ALL_LIBRARIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [year, setYear] = useState("");
  const [years, setYears] = useState<number[]>(home.years ?? []);
  const [catalogItems, setCatalogItems] = useState<MediaCard[]>(initialBrowse?.items ?? []);
  const [catalogTotal, setCatalogTotal] = useState(initialBrowse?.total ?? 0);
  const [hasMore, setHasMore] = useState(initialBrowse?.hasMore ?? false);
  const [browseLoading, setBrowseLoading] = useState(!initialBrowse);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchItems, setSearchItems] = useState<MediaCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [info, setInfo] = useState<MediaCard | null>(null);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [recentRevision, setRecentRevision] = useState(0);
  const [progressTick, setProgressTick] = useState(0);
  const [recentCards, setRecentCards] = useState<RecentWatchCard[]>([]);
  const castRow = useRef<HTMLDivElement>(null);
  const detailsCacheRef = useRef<Map<string, MediaDetails>>(new Map());
  const catalogById = useMemo(() => {
    const map = new Map<string, MediaCard>();
    for (const item of [...catalogItems, ...searchItems]) {
      map.set(item.id, item);
    }
    return map;
  }, [catalogItems, searchItems]);
  const catalogByIdRef = useRef(catalogById);
  catalogByIdRef.current = catalogById;

  const libraryHeading = useMemo(() => {
    if (libraryId === ALL_LIBRARIES) return "All Movies & Series";
    return home.libraries.find((library) => library.id === libraryId)?.name ?? "All Movies & Series";
  }, [home.libraries, libraryId]);

  const searchActive = debouncedSearch.trim().length > 0;
  const showSearchHints = searchActive;
  const movies = useMemo(
    () => searchItems.filter((item) => item.kind === "movie"),
    [searchItems],
  );
  const series = useMemo(
    () => searchItems.filter((item) => item.kind === "series"),
    [searchItems],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 280);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    if (libraryId === ALL_LIBRARIES && (home.years?.length ?? 0) > 0) {
      setYears(home.years ?? []);
      return;
    }
    let cancelled = false;
    void getMediaYears(libraryId).then((values) => {
      if (!cancelled) setYears(values);
    });
    return () => {
      cancelled = true;
    };
  }, [home.years, libraryId]);

  useEffect(() => {
    if (searchActive) return;
    const filterKey = `${libraryId}|${year}`;
    if (lastBrowseFilterKeyRef.current === filterKey) return;
    lastBrowseFilterKeyRef.current = filterKey;
    let cancelled = false;
    setBrowseLoading(true);
    setCatalogItems([]);
    setHasMore(false);
    void getMediaBrowse({
      libraryId,
      year,
      offset: 0,
      limit: pageSize,
    }).then((result) => {
      if (cancelled) return;
      setCatalogItems(result.items);
      setCatalogTotal(result.total);
      setHasMore(result.hasMore);
      setBrowseLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // pageSize intentionally omitted — desktop growth uses append effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, year, searchActive]);

  useEffect(() => {
    if (!searchActive) {
      setSearchItems([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void getMediaBrowse({
      libraryId,
      year,
      q: debouncedSearch,
      offset: 0,
      limit: MEDIA_SEARCH_LIMIT,
    }).then((result) => {
      if (cancelled) return;
      setSearchItems(result.items);
      setSearchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [libraryId, year, debouncedSearch, searchActive]);

  useEffect(() => {
    if (searchActive || browseLoading || loadingMore || !hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        observer.disconnect();
        setLoadingMore(true);
        const offset = catalogItems.length;
        void getMediaBrowse({
          libraryId,
          year,
          offset,
          limit: pageSize,
        })
          .then((result) => {
            setCatalogItems((prev) => {
              const seen = new Set(prev.map((item) => item.id));
              const merged = [...prev];
              for (const item of result.items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                merged.push(item);
              }
              return merged;
            });
            setCatalogTotal(result.total);
            setHasMore(result.hasMore && result.items.length > 0);
          })
          .finally(() => {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          });
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    browseLoading,
    catalogItems.length,
    hasMore,
    libraryId,
    loadingMore,
    pageSize,
    searchActive,
    year,
  ]);

  useEffect(() => {
    if (searchActive || browseLoading) return;
    if (catalogItems.length >= pageSize || !hasMore) return;
    let cancelled = false;
    void getMediaBrowse({
      libraryId,
      year,
      offset: catalogItems.length,
      limit: pageSize - catalogItems.length,
    }).then((result) => {
      if (cancelled || result.items.length === 0) return;
      setCatalogItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        for (const item of result.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
        }
        return merged;
      });
      setCatalogTotal(result.total);
      setHasMore(result.hasMore);
    });
    return () => {
      cancelled = true;
    };
  }, [
    browseLoading,
    catalogItems.length,
    hasMore,
    libraryId,
    pageSize,
    searchActive,
    year,
  ]);

  useLayoutEffect(() => {
    syncRecentFromLegacyWatchKeys();
    const entries = readRecentWatched();
    if (entries.length === 0) return;
    const catalog = new Map(catalogByIdRef.current);
    for (const item of initialBrowse?.items ?? []) catalog.set(item.id, item);
    const hydrated = hydrateRecentCards(entries, catalog).map(snapshotToRecentCard);
    setRecentCards((prev) => (sameRecentCards(prev, hydrated) ? prev : hydrated));
  }, [initialBrowse]);

  useEffect(() => {
    const refreshList = () => setRecentRevision((value) => value + 1);
    const refreshProgress = () => setProgressTick((value) => value + 1);
    window.addEventListener("uniqbd-media-recent-changed", refreshList);
    window.addEventListener("storage", refreshList);
    window.addEventListener("focus", refreshProgress);
    return () => {
      window.removeEventListener("uniqbd-media-recent-changed", refreshList);
      window.removeEventListener("storage", refreshList);
      window.removeEventListener("focus", refreshProgress);
    };
  }, []);

  useEffect(() => {
    void recentRevision;
    let cancelled = false;

    const entries = readRecentWatched();
    if (entries.length === 0) {
      setRecentCards((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const seeded = hydrateRecentCards(entries, catalogByIdRef.current).map(snapshotToRecentCard);
    setRecentCards((prev) => (sameRecentCards(prev, seeded) ? prev : seeded));

    void (async () => {
      const cards = await Promise.all(
        entries.map(async (entry) => {
          const cached = catalogByIdRef.current.get(entry.id);
          if (cached) {
            return {
              ...cached,
              runtimeMinutes:
                seeded.find((card) => card.id === entry.id)?.runtimeMinutes ?? null,
            } satisfies RecentWatchCard;
          }
          try {
            const response = await fetch(`${API_BASE}/media/titles/${entry.id}`);
            if (!response.ok) return null;
            const data = (await response.json()) as MediaDetails;
            return {
              id: entry.id,
              title: data.title,
              year: data.year,
              kind: data.kind,
              posterUrl: data.posterUrl,
              featured: false,
              trending: false,
              seasonCount: null,
              runtimeMinutes: data.runtimeMinutes,
            } satisfies RecentWatchCard;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next = cards.filter((card): card is RecentWatchCard => card != null);
      for (const card of next) persistRecentSnapshot(recentCardSnapshot(card));
      setRecentCards((prev) => (sameRecentCards(prev, next) ? prev : next));
    })();

    return () => {
      cancelled = true;
    };
  }, [recentRevision]);

  useEffect(() => {
    for (const card of recentCards.slice(0, 6)) {
      router.prefetch(mediaWatchPath(card.id) as Route);
    }
  }, [recentCards, router]);

  useEffect(() => {
    setInfo(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!info) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfo(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [info]);

  useEffect(() => {
    if (!info) {
      setDetails(null);
      return;
    }
    const cached = detailsCacheRef.current.get(info.id);
    if (cached) {
      setDetails(cached);
    } else {
      setDetails(null);
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const load = (allowRetry: boolean) => {
      fetch(`${API_BASE}/media/titles/${info.id}`)
        .then((response) => (response.ok ? (response.json() as Promise<MediaDetails>) : null))
        .then((data) => {
          if (cancelled || !data) return;
          detailsCacheRef.current.set(info.id, data);
          setDetails(data);
          if (
            allowRetry &&
            !data.detailsLoaded &&
            !data.overview?.trim() &&
            (data.cast?.length ?? 0) === 0
          ) {
            retryTimer = window.setTimeout(() => load(false), 2800);
          }
        })
        .catch(() => {
          if (!cancelled && !cached) setDetails(null);
        });
    };

    load(true);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [info]);

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Media</h1>

      <div className={styles.toolbarSticky}>
      <section className={styles.panel}>
        <div className={styles.filters}>
          <div className={styles.filterRowMobile1}>
          <label className={styles.field}>
            <span className="sr-only">Media Menu</span>
            <span className={styles.selectWrap}>
              <select
                className={styles.control}
                value={libraryId}
                aria-label="Media Menu"
                onChange={(event) => {
                  setLibraryId(event.target.value);
                  setYear("");
                }}
              >
                <option value={ALL_LIBRARIES}>All Movies & Series</option>
                {home.libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={styles.field}>
            <span className="sr-only">Genre</span>
            <span className={styles.selectWrap}>
              <select className={styles.control} defaultValue="" aria-label="Genre">
                <option value="">Genres</option>
              </select>
            </span>
          </label>
          </div>
          <div className={styles.filterRowMobile2}>
          <label className={styles.field}>
            <span className="sr-only">Year</span>
            <span className={styles.selectWrap}>
              <select
                className={styles.control}
                value={year}
                aria-label="Year"
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">Years</option>
                {years.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={styles.field}>
            <span className="sr-only">Min rating</span>
            <span className={styles.selectWrap}>
              <select className={styles.control} defaultValue="" aria-label="Minimum rating">
                <option value="">Rating</option>
              </select>
            </span>
          </label>
          <label className={`${styles.field} ${styles.searchField}`}>
            <span className="sr-only">Search</span>
            <span className={styles.searchWrap}>
              <span className={styles.searchIcon} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className={styles.searchIconLens} cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path className={styles.searchIconHandle} d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                className={styles.searchInput}
                value={searchQuery}
                placeholder="Search"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search movie or series"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className={styles.searchClear}
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              ) : null}
            </span>
          </label>
          </div>
        </div>
        {showSearchHints ? (
          <div className={styles.searchHints} role="listbox" aria-label="Search results">
            <SearchHintSection label="Movies" count={movies.length} items={movies} onSelect={setInfo} />
            <SearchHintSection label="Series" count={series.length} items={series} onSelect={setInfo} />
          </div>
        ) : null}
      </section>
      </div>

      {!searchActive && recentCards.some((card) => card.title.trim() || card.posterUrl) ? (
        <RecentlyWatchedSlider items={recentCards} progressRevision={progressTick} onSelect={setInfo} />
      ) : null}

      {!searchActive && browseLoading && catalogItems.length === 0 ? (
        <p className={styles.empty}>Loading titles…</p>
      ) : null}
      {!searchActive && !browseLoading && catalogTotal === 0 ? (
        <p className={styles.empty}>
          {home.libraries.length === 0
            ? "No media libraries yet."
            : libraryId === ALL_LIBRARIES
              ? "No movies or series published yet."
              : "No titles in this library yet."}
        </p>
      ) : null}
      {!searchActive && catalogItems.length > 0 ? (
        <div className={styles.catalog}>
          <h2 className={styles.recentHeading}>{libraryHeading}</h2>
          <section className={styles.catalogSection} aria-label={libraryHeading}>
            <TitleGrid items={catalogItems} onSelect={setInfo} />
            {hasMore ? (
              <div ref={loadMoreRef} className={styles.loadMoreSentinel} aria-hidden>
                {loadingMore ? "Loading more…" : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {searchActive && searchLoading ? (
        <p className={styles.empty}>Searching…</p>
      ) : null}
      {searchActive && !searchLoading && searchItems.length === 0 ? (
        <p className={styles.empty}>No movies or series match your search.</p>
      ) : null}

      {info ? (
        <MovieInfo
          key={info.id}
          card={info}
          details={details}
          castRow={castRow}
          onClose={() => setInfo(null)}
        />
      ) : null}
    </div>
  );
}

function RecentlyWatchedSlider({
  items,
  progressRevision,
  onSelect,
}: {
  items: RecentWatchCard[];
  progressRevision: number;
  onSelect: (item: MediaCard) => void;
}) {
  void progressRevision;
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const syncScrollButtons = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      setCanScrollBack(false);
      setCanScrollForward(false);
      return;
    }
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollBack(track.scrollLeft > 4);
    setCanScrollForward(maxScroll - track.scrollLeft > 4);
  }, []);

  useEffect(() => {
    syncScrollButtons();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", syncScrollButtons, { passive: true });
    window.addEventListener("resize", syncScrollButtons);
    return () => {
      track.removeEventListener("scroll", syncScrollButtons);
      window.removeEventListener("resize", syncScrollButtons);
    };
  }, [items.length, syncScrollButtons]);

  const scrollRecent = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const step = Math.max(track.clientWidth * 0.82, 160);
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section className={styles.recentSection} aria-label="Recently Watched">
      <h2 className={styles.recentHeading}>Recently Watched</h2>
      <div className={styles.recentCarousel}>
        {canScrollBack ? (
          <button
            type="button"
            className={`${styles.recentNavBtn} ${styles.recentNavPrev}`}
            aria-label="Scroll recently watched left"
            onClick={() => scrollRecent(-1)}
          >
            <span className={styles.recentNavIcon} aria-hidden>
              ‹
            </span>
          </button>
        ) : null}
        <div className={styles.recentTrack} ref={trackRef}>
        {items.map((item, index) => {
          const progress = watchProgressPercent(item.id, item.runtimeMinutes);
          if (!item.title.trim() && !item.posterUrl) return null;
          return (
            <article key={item.id} className={`${styles.card} ${styles.recentCard}`}>
              <PosterPlayLink id={item.id} title={item.title || "video"}>
                <span className={styles.posterFrame}>
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.posterImage}
                      src={item.posterUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      decoding="async"
                      loading={index < 4 ? "eager" : "lazy"}
                      fetchPriority={index < 2 ? "high" : "auto"}
                    />
                  ) : (
                    <span className={styles.posterFallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
                  )}
                  <span className={styles.playOverlay} aria-hidden>
                    <span className={styles.playButton} />
                  </span>
                  {progress > 0 ? (
                    <span className={styles.recentProgressTrack} aria-hidden>
                      <span className={styles.recentProgressFill} style={{ width: `${progress}%` }} />
                    </span>
                  ) : null}
                </span>
              </PosterPlayLink>
              <button type="button" className={styles.cardTitle} onClick={() => onSelect(item)}>
                {item.title}
              </button>
              {item.year ? (
                <button type="button" className={styles.cardMeta} onClick={() => onSelect(item)}>
                  {item.year}
                </button>
              ) : null}
            </article>
          );
        })}
        </div>
        {canScrollForward ? (
          <button
            type="button"
            className={`${styles.recentNavBtn} ${styles.recentNavNext}`}
            aria-label="Scroll recently watched right"
            onClick={() => scrollRecent(1)}
          >
            <span className={styles.recentNavIcon} aria-hidden>
              ›
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SearchHintSection({
  label,
  count,
  items,
  onSelect,
}: {
  label: string;
  count: number;
  items: MediaCard[];
  onSelect: (item: MediaCard) => void;
}) {
  return (
    <div className={styles.searchHintCol}>
      <p className={styles.searchHintTitle}>
        {label} <span className={styles.searchHintCount}>{count}</span>
      </p>
      {items.length === 0 ? (
        <p className={styles.searchHintEmpty}>No matches</p>
      ) : (
        <ul className={styles.searchHintGrid}>
          {items.map((item) => (
            <li key={item.id}>
              <div className={styles.searchHintCard}>
                <PosterPlayLink id={item.id} title={item.title} className={styles.searchHintPosterLink}>
                  <span className={styles.searchHintPoster}>
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.posterUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className={styles.searchHintFallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
                    )}
                  </span>
                </PosterPlayLink>
                <button type="button" className={styles.searchHintMetaBtn} onClick={() => onSelect(item)}>
                  <span className={styles.searchHintName}>{item.title}</span>
                  {item.year ? <span className={styles.searchHintYear}>{item.year}</span> : null}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function mediaWatchPath(id: string): string {
  return `/media/watch/${encodeURIComponent(id)}`;
}

function useNavigateToWatch() {
  const router = useRouter();
  return useCallback(
    (id: string) => {
      const path = mediaWatchPath(id);
      const mobile = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
      if (mobile) {
        sessionStorage.setItem("uniqbd-mobile-autoplay", String(Date.now()));
        router.push(`${path}?autoplay=1` as Route);
        return;
      }
      router.push(path as Route);
    },
    [router],
  );
}

function PosterPlayLink({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const navigateToWatch = useNavigateToWatch();
  const linkClass = className ? `${styles.posterLink} ${className}` : styles.posterLink;

  return (
    <button
      type="button"
      className={linkClass}
      aria-label={`Play ${title}`}
      onClick={() => navigateToWatch(id)}
    >
      {children}
    </button>
  );
}

function WatchPlayButton({
  id,
  className,
  children,
  onBeforeNavigate,
}: {
  id: string;
  className?: string;
  children: ReactNode;
  onBeforeNavigate?: () => void;
}) {
  const navigateToWatch = useNavigateToWatch();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onBeforeNavigate?.();
        navigateToWatch(id);
      }}
    >
      {children}
    </button>
  );
}

function TitleGrid({ items, onSelect }: { items: MediaCard[]; onSelect: (item: MediaCard) => void }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article key={item.id} className={styles.card}>
          <PosterPlayLink id={item.id} title={item.title}>
            <span className={styles.posterFrame}>
              {item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.posterImage}
                  src={item.posterUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className={styles.posterFallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
              )}
              <span className={styles.playOverlay} aria-hidden>
                <span className={styles.playButton} />
              </span>
            </span>
          </PosterPlayLink>
          <button type="button" className={styles.cardTitle} onClick={() => onSelect(item)}>
            {item.title}
          </button>
          <button type="button" className={styles.cardMeta} onClick={() => onSelect(item)}>
            {[item.kind === "series" ? "Series" : "Movie", item.year ? String(item.year) : null]
              .filter(Boolean)
              .join(" · ")}
          </button>
        </article>
      ))}
    </div>
  );
}

function MovieInfo({
  card,
  details,
  castRow,
  onClose,
}: {
  card: MediaCard;
  details: MediaDetails | null;
  castRow: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const title = details?.title || card.title;
  const year = details?.year || card.year;
  const poster = details?.posterUrl || card.posterUrl;
  const backdrop = details?.backdropUrl || null;
  const kind = details?.kind || card.kind;
  const detailsPending =
    !details ||
    (!details.detailsLoaded &&
      !details.overview?.trim() &&
      (details.cast?.length ?? 0) === 0);
  const meta = [
    year ? String(year) : null,
    details?.runtimeMinutes ? `${details.runtimeMinutes} min` : null,
    details?.rating ? `★ ${details.rating}` : null,
  ].filter(Boolean);

  return (
    <div className={styles.infoOverlay} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.infoBackdrop} aria-label="Close" onClick={onClose} />
      <div className={`${styles.infoSheet}${backdrop ? "" : ` ${styles.infoSheetCompactHero}`}`}>
        <div className={`${styles.hero}${backdrop ? "" : ` ${styles.heroCompact}`}`}>
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdrop} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
          ) : null}
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.headerBlock}>
          <div className={styles.poster}>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" referrerPolicy="no-referrer" loading="eager" decoding="async" />
            ) : null}
          </div>
          <div className={styles.headerCopy}>
            <p className={styles.kicker}>{kind === "series" ? "Series" : "Movie"}</p>
            <h2>{title}</h2>
            {meta.length > 0 ? <p className={styles.meta}>{meta.join(" · ")}</p> : null}
            {details?.genres?.length ? (
              <div className={styles.genres}>
                {details.genres.map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.body}>
          {details?.overview ? (
            <p className={styles.overview}>{details.overview}</p>
          ) : detailsPending ? (
            <p className={styles.overviewMuted}>Loading description…</p>
          ) : (
            <p className={styles.overviewMuted}>No description available.</p>
          )}
          <div className={styles.actions}>
            <WatchPlayButton id={card.id} className={styles.play} onBeforeNavigate={onClose}>
              ▶ Play
            </WatchPlayButton>
            <span className={styles.ghost}>+ My List</span>
            <span className={styles.ghost}>Mark watched</span>
          </div>
          {details && (details.directors.length > 0 || details.writers.length > 0 || details.cast.length > 0) ? (
            <section className={styles.castSection}>
              <div className={styles.castHead}>
                <h3>Cast & Crew</h3>
                <div>
                  <button type="button" aria-label="Previous cast" onClick={() => castRow.current?.scrollBy({ left: -240, behavior: "smooth" })}>
                    ‹
                  </button>
                  <button type="button" aria-label="Next cast" onClick={() => castRow.current?.scrollBy({ left: 240, behavior: "smooth" })}>
                    ›
                  </button>
                </div>
              </div>
              {details.directors.length > 0 || details.writers.length > 0 ? (
                <p className={styles.credits}>
                  {details.directors.length > 0 ? <span>Directors · {details.directors.join(", ")}</span> : null}
                  {details.writers.length > 0 ? <span>Writers · {details.writers.join(", ")}</span> : null}
                </p>
              ) : null}
              <div className={styles.castRow} ref={castRow}>
                {details.cast.map((person) => (
                  <article key={person.name} className={styles.person}>
                    <span>
                      {person.profileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.profileUrl} alt="" referrerPolicy="no-referrer" />
                      ) : null}
                    </span>
                    <strong>{person.name}</strong>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
