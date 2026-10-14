"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { API_BASE } from "@/lib/api";
import styles from "./media-home.module.css";
import {
  readRecentWatched,
  syncRecentFromLegacyWatchKeys,
  watchProgressPercent,
} from "@/lib/media-recent-watched";
import type { MediaCard, MediaHome } from "@/lib/media-home-api";

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
};

const ALL_LIBRARIES = "all";

function sortByNewestFirst(items: MediaCard[]): MediaCard[] {
  return [...items].sort((a, b) => (b.sortAt ?? 0) - (a.sortAt ?? 0));
}

type RecentWatchCard = MediaCard & {
  runtimeMinutes?: number | null;
};

function matchesSearch(title: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const hay = title.toLowerCase();
  return words.every((word) => hay.includes(word));
}

export function MediaHome({ home }: { home: MediaHome }) {
  const source = useMemo(() => {
    const raw = home.items.length > 0 ? home.items : home.rows.flatMap((row) => row.items);
    const seen = new Set<string>();
    const unique = raw.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return sortByNewestFirst(unique);
  }, [home.items, home.rows]);
  const [libraryId, setLibraryId] = useState(ALL_LIBRARIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [year, setYear] = useState("");
  const [info, setInfo] = useState<MediaCard | null>(null);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [recentRevision, setRecentRevision] = useState(0);
  const [recentCards, setRecentCards] = useState<RecentWatchCard[]>([]);
  const castRow = useRef<HTMLDivElement>(null);
  const catalogById = useMemo(() => new Map(source.map((item) => [item.id, item])), [source]);
  const libraryItems = useMemo(() => {
    const scoped =
      libraryId === ALL_LIBRARIES
        ? source
        : source.filter((item) => item.libraryId === libraryId);
    return sortByNewestFirst(scoped);
  }, [source, libraryId]);

  const years = useMemo(
    () => [...new Set(libraryItems.map((item) => item.year).filter((value) => value > 0))].sort((a, b) => b - a),
    [libraryItems],
  );

  const visible = useMemo(
    () =>
      libraryItems.filter(
        (item) => (!year || String(item.year) === year) && matchesSearch(item.title, searchQuery),
      ),
    [libraryItems, year, searchQuery],
  );

  const movies = useMemo(() => visible.filter((item) => item.kind === "movie"), [visible]);
  const series = useMemo(() => visible.filter((item) => item.kind === "series"), [visible]);

  const libraryHeading = useMemo(() => {
    if (libraryId === ALL_LIBRARIES) return "All Movies & Series";
    return home.libraries.find((library) => library.id === libraryId)?.name ?? "All Movies & Series";
  }, [home.libraries, libraryId]);

  const searchActive = searchQuery.trim().length > 0;
  const showSearchHints = searchActive;

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
    if (!info) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    setDetails(null);
    fetch(`${API_BASE}/media/titles/${info.id}`)
      .then((response) => (response.ok ? (response.json() as Promise<MediaDetails>) : null))
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
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

      {!searchActive && visible.length === 0 ? (
        <p className={styles.empty}>
          {home.libraries.length === 0
            ? "No media libraries yet."
            : libraryId === ALL_LIBRARIES
              ? "No movies or series published yet."
              : "No titles in this library yet."}
        </p>
      ) : null}
      {!searchActive && visible.length > 0 ? (
        <div className={styles.catalog}>
          <h2 className={styles.recentHeading}>{libraryHeading}</h2>
          {movies.length > 0 ? (
            <section className={styles.catalogSection} aria-label="Movies">
              <TitleGrid items={movies} onSelect={setInfo} />
            </section>
          ) : null}
          {series.length > 0 ? (
            <section className={styles.catalogSection} aria-label="Series">
              <TitleGrid items={series} onSelect={setInfo} />
            </section>
          ) : null}
        </div>
      ) : null}
      {searchActive && visible.length === 0 ? (
        <p className={styles.empty}>No movies or series match your search.</p>
      ) : null}

      {info ? (
        <MovieInfo
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
                <img className={styles.posterImage} src={item.posterUrl} alt="" referrerPolicy="no-referrer" />
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
  const backdrop = details?.backdropUrl || poster;
  const kind = details?.kind || card.kind;
  const meta = [
    year ? String(year) : null,
    details?.runtimeMinutes ? `${details.runtimeMinutes} min` : null,
    details?.rating ? `★ ${details.rating}` : null,
  ].filter(Boolean);

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.hero}>
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdrop} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.headerBlock}>
          <div className={styles.poster}>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" referrerPolicy="no-referrer" />
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
          {details?.overview ? <p className={styles.overview}>{details.overview}</p> : <p className={styles.overview}>Loading movie info…</p>}
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
