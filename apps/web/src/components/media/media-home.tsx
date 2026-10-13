"use client";

import { useMemo, useState } from "react";
import styles from "./media-home.module.css";
import type { MediaCard, MediaHome } from "@/lib/media-home-api";

export function MediaHome({ home }: { home: MediaHome }) {
  const source = home.items.length > 0 ? home.items : home.rows.flatMap((row) => row.items);
  const [libraryId, setLibraryId] = useState(home.libraries[0]?.id ?? "");
  const [year, setYear] = useState("");
  const [info, setInfo] = useState<MediaCard | null>(null);
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
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={info.title} onClick={() => setInfo(null)}>
          <div className={styles.dialogCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.dialogPoster}>
              {info.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.posterUrl} alt="" referrerPolicy="no-referrer" />
              ) : null}
            </div>
            <div className={styles.dialogBody}>
              <h2>{info.title}</h2>
              <p>
                {info.year} · {info.kind === "series" ? "Series" : "Movie"}
              </p>
              <button type="button" className={styles.close} onClick={() => setInfo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
