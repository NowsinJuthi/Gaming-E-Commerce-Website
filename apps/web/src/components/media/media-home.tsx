"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "@/lib/api";
import styles from "./media-home.module.css";
import {
  readRecentWatched,
  syncRecentFromLegacyWatchKeys,
  watchProgressPercent,
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

export function MediaHome({
  home,
  initialBrowse,
}: {
  home: MediaHome;
  initialBrowse?: MediaBrowseResult;
}) {
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
  const [recentCards, setRecentCards] = useState<RecentWatchCard[]>([]);
  const castRow = useRef<HTMLDivElement>(null);
  const detailsCacheRef = useRef<Map<string, MediaDetails>>(new Map());
  const [portalReady, setPortalReady] = useState(false);
  const catalogById = useMemo(() => {
    const map = new Map<string, MediaCard>();
    for (const item of [...catalogItems, ...searchItems, ...recentCards]) {
      map.set(item.id, item);
    }
    return map;
  }, [catalogItems, searchItems, recentCards]);

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
            setHasMore(result.hasMore);
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

  useEffect(() => {
    const refresh = () => setRecentRevision((value) => value + 1);
    syncRecentFromLegacyWatchKeys();
    refresh();
    window.addEventListener("uniqbd-media-recent-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("uniqbd-media-recent-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    void recentRevision;
    let cancelled = false;

    const entries = readRecentWatched();
    if (entries.length === 0) {
      setRecentCards([]);
      return;
    }

    void (async () => {
      const cards: RecentWatchCard[] = [];
      for (const entry of entries) {
        const cached = catalogById.get(entry.id);
        if (cached) {
          cards.push({ ...cached, runtimeMinutes: null });
          continue;
        }
        try {
          const response = await fetch(`${API_BASE}/media/titles/${entry.id}`);
          if (!response.ok) continue;
          const data = (await response.json()) as MediaDetails;
          cards.push({
            id: entry.id,
            title: data.title,
            year: data.year,
            kind: data.kind,
            posterUrl: data.posterUrl,
            featured: false,
            trending: false,
            seasonCount: null,
            runtimeMinutes: data.runtimeMinutes,
          });
        } catch {
          /* skip unavailable titles */
        }
      }
      if (!cancelled) setRecentCards(cards);
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogById, recentRevision]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!info) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfo(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
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

      {!searchActive && recentCards.length > 0 ? (
        <RecentlyWatchedSlider items={recentCards} progressRevision={recentRevision} onSelect={setInfo} />
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

      {info && portalReady
        ? createPortal(
            <MovieInfo
              card={info}
              details={details}
              castRow={castRow}
              onClose={() => setInfo(null)}
            />,
            document.body,
          )
        : null}
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
        {items.map((item) => {
          const progress = watchProgressPercent(item.id, item.runtimeMinutes);
          return (
            <article key={item.id} className={`${styles.card} ${styles.recentCard}`}>
              <Link
                className={styles.posterLink}
                href={`/media/watch/${item.id}` as Route}
                aria-label={`Play ${item.title}`}
              >
                <span className={styles.posterFrame}>
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.posterImage} src={item.posterUrl} alt="" referrerPolicy="no-referrer" />
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
              </Link>
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
                <Link
                  className={styles.searchHintPosterLink}
                  href={`/media/watch/${item.id}` as Route}
                  aria-label={`Play ${item.title}`}
                >
                  <span className={styles.searchHintPoster}>
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.posterUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className={styles.searchHintFallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
                    )}
                  </span>
                </Link>
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

function TitleGrid({ items, onSelect }: { items: MediaCard[]; onSelect: (item: MediaCard) => void }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article key={item.id} className={styles.card}>
          <Link
            className={styles.posterLink}
            href={`/media/watch/${item.id}` as Route}
            aria-label={`Play ${item.title}`}
          >
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
          </Link>
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
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={`${styles.sheet}${backdrop ? "" : ` ${styles.sheetCompactHero}`}`}>
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
            <Link className={styles.play} href={`/media/watch/${card.id}` as Route}>
              ▶ Play
            </Link>
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
