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

export function MediaHome({ home }: { home: MediaHome }) {
  const source = home.items.length > 0 ? home.items : home.rows.flatMap((row) => row.items);
  const [libraryId, setLibraryId] = useState(home.libraries[0]?.id ?? "");
  const [year, setYear] = useState("");
  const [info, setInfo] = useState<MediaCard | null>(null);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const castRow = useRef<HTMLDivElement>(null);
  const selected = home.libraries.find((library) => library.id === libraryId) ?? home.libraries[0] ?? null;
  const activeLibraryId = selected?.id ?? "";

  const libraryItems = useMemo(
    () => source.filter((item) => item.libraryId === activeLibraryId),
    [source, activeLibraryId],
  );

  const years = useMemo(
    () => [...new Set(libraryItems.map((item) => item.year).filter((value) => value > 0))].sort((a, b) => b - a),
    [libraryItems],
  );

  const visible = useMemo(
    () => libraryItems.filter((item) => !year || String(item.year) === year),
    [libraryItems, year],
  );

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
      <h1 className={styles.heading}>{selected?.name ?? "Media"}</h1>

      <section className={styles.panel}>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.label}>Media Menu</span>
            <span className={styles.selectWrap}>
              <select
                className={styles.control}
                value={activeLibraryId}
                onChange={(event) => {
                  setLibraryId(event.target.value);
                  setYear("");
                }}
              >
                {home.libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
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

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {home.libraries.length === 0
            ? "No media libraries yet."
            : "No titles in this library yet."}
        </p>
      ) : (
        <div className={styles.grid}>
          {visible.map((item) => (
            <article key={item.id} className={styles.card}>
              <button type="button" className={styles.posterLink} onClick={() => setInfo(item)} aria-label={item.title}>
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
              <button type="button" className={styles.cardTitle} onClick={() => setInfo(item)}>
                {item.title}
              </button>
              {item.year ? (
                <button type="button" className={styles.cardYear} onClick={() => setInfo(item)}>
                  {item.year}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

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
