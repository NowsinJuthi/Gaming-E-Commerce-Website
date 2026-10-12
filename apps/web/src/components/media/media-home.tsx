"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./media-home.module.css";
import type { MediaCard, MediaHome } from "@/lib/media-home-api";

export function MediaHome({ home }: { home: MediaHome }) {
  const slides = home.hero;
  const [index, setIndex] = useState(0);
  const [info, setInfo] = useState<MediaCard | null>(null);
  const active = slides[index] ?? null;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <>
      <section className={styles.hero} aria-label="Media">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.id}
            className={styles.slide}
            style={{ opacity: slideIndex === index ? 1 : 0 }}
            aria-hidden={slideIndex !== index}
          >
            {slide.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.slideImage} src={slide.posterUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
          </div>
        ))}
        <div className={styles.shade} />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Media</p>
          <h2 className={styles.title}>{active?.title ?? "Movies and series"}</h2>
          <p className={styles.meta}>
            {active
              ? [active.year, active.kind === "series" ? "Series" : "Movie", active.seasonCount ? `${active.seasonCount} seasons` : null]
                  .filter(Boolean)
                  .join(" · ")
              : "Featured titles, movies, and series in one place."}
          </p>
          <p className={styles.summary}>
            {active
              ? active.trending
                ? "Trending on UniQbd Media."
                : "Watch this title from the UniQbd media library."
              : "Published movies and series show up here, in the same shelves as a streaming home page."}
          </p>
          {active ? (
            <div className={styles.actions}>
              <button type="button" className={styles.play} onClick={() => setInfo(active)}>
                Play
              </button>
              <button type="button" className={styles.info} onClick={() => setInfo(active)}>
                More info
              </button>
            </div>
          ) : null}
        </div>
        {slides.length > 1 ? (
          <div className={styles.dots}>
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                className={`${styles.dot} ${slideIndex === index ? styles.dotActive : ""}`}
                aria-label={`Go to ${slide.title}`}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {home.rows.length === 0 ? (
        <p className={styles.empty}>No published titles yet. Publish a movie or series from Movie Server to fill this page.</p>
      ) : (
        <div className={styles.rows}>
          {home.rows.map((row) => (
            <MediaRowView key={row.id} title={row.title} items={row.items} onOpen={setInfo} />
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
                {info.seasonCount ? ` · ${info.seasonCount} seasons` : ""}
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.info} onClick={() => setInfo(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MediaRowView({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: MediaCard[];
  onOpen: (card: MediaCard) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function scroll(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.8, 240), behavior: "smooth" });
  }

  return (
    <section>
      <div className={styles.rowHead}>
        <h2 className={styles.rowTitle}>{title}</h2>
      </div>
      <div className={styles.scrollerWrap}>
        <button type="button" className={`${styles.scrollBtn} ${styles.scrollLeft}`} aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>
          ‹
        </button>
        <div className={styles.scroller} ref={scroller}>
          {items.map((item) => (
            <button key={item.id} type="button" className={styles.card} onClick={() => onOpen(item)}>
              <span className={styles.poster}>
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className={styles.fallback}>{item.title.trim().charAt(0).toUpperCase() || "M"}</span>
                )}
              </span>
              <span className={styles.cardName}>{item.title}</span>
              <span className={styles.cardMeta}>
                {item.year} · {item.kind === "series" ? "Series" : "Movie"}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={`${styles.scrollBtn} ${styles.scrollRight}`} aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>
          ›
        </button>
      </div>
    </section>
  );
}
