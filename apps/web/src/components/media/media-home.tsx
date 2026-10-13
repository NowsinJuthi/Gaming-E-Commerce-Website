"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { API_BASE } from "@/lib/api";
import styles from "./media-home.module.css";
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
    return raw.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [home.items, home.rows]);
  const [libraryId, setLibraryId] = useState(ALL_LIBRARIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [year, setYear] = useState("");
  const [info, setInfo] = useState<MediaCard | null>(null);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const castRow = useRef<HTMLDivElement>(null);
  const libraryItems = useMemo(
    () =>
      libraryId === ALL_LIBRARIES
        ? source
        : source.filter((item) => item.libraryId === libraryId),
    [source, libraryId],
  );

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

  const searchActive = searchQuery.trim().length > 0;
  const showSearchHints = searchActive;

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

      <section className={styles.panel}>
        <div className={styles.librarySection}>
          <div className={styles.libraryMenu} role="tablist" aria-label="Media libraries">
            <button
              type="button"
              role="tab"
              aria-selected={libraryId === ALL_LIBRARIES}
              className={`${styles.menuChip} ${libraryId === ALL_LIBRARIES ? styles.menuChipActive : ""}`}
              onClick={() => {
                setLibraryId(ALL_LIBRARIES);
                setYear("");
              }}
            >
              All
            </button>
            {home.libraries.map((library) => (
              <button
                key={library.id}
                type="button"
                role="tab"
                aria-selected={libraryId === library.id}
                className={`${styles.menuChip} ${libraryId === library.id ? styles.menuChipActive : ""}`}
                onClick={() => {
                  setLibraryId(library.id);
                  setYear("");
                }}
              >
                {library.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.searchRow}>
          <label className={`${styles.field} ${styles.searchField}`}>
            <span className={styles.label}>Search</span>
            <span className={styles.searchWrap}>
              <input
                type="search"
                className={styles.searchInput}
                value={searchQuery}
                placeholder="Type movie or series name…"
                autoComplete="off"
                spellCheck={false}
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
          {showSearchHints ? (
            <div className={styles.searchHints} role="listbox" aria-label="Search results">
              <SearchHintSection label="Movies" count={movies.length} items={movies} onSelect={setInfo} />
              <SearchHintSection label="Series" count={series.length} items={series} onSelect={setInfo} />
            </div>
          ) : null}
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.label}>Genre</span>
            <span className={styles.selectWrap}>
              <select className={styles.control} defaultValue="">
                <option value="">All genres</option>
              </select>
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Year</span>
            <span className={styles.selectWrap}>
              <select className={styles.control} value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">All years</option>
                {years.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Min rating</span>
            <span className={styles.selectWrap}>
              <select className={styles.control} defaultValue="">
                <option value="">Any rating</option>
              </select>
            </span>
          </label>
        </div>
      </section>

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
          {movies.length > 0 ? (
            <section className={styles.catalogSection} aria-labelledby="media-movies-heading">
              <h2 id="media-movies-heading" className={styles.sectionHeading}>
                Movies <span className={styles.sectionCount}>{movies.length}</span>
              </h2>
              <TitleGrid items={movies} onSelect={setInfo} />
            </section>
          ) : null}
          {series.length > 0 ? (
            <section className={styles.catalogSection} aria-labelledby="media-series-heading">
              <h2 id="media-series-heading" className={styles.sectionHeading}>
                Series <span className={styles.sectionCount}>{series.length}</span>
              </h2>
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
              <button type="button" className={styles.searchHintCard} onClick={() => onSelect(item)}>
                <span className={styles.searchHintPoster}>
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.posterUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className={styles.searchHintFallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
                  )}
                </span>
                <span className={styles.searchHintName}>{item.title}</span>
                {item.year ? <span className={styles.searchHintYear}>{item.year}</span> : null}
              </button>
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
          <button type="button" className={styles.posterLink} onClick={() => onSelect(item)} aria-label={item.title}>
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
          </button>
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
