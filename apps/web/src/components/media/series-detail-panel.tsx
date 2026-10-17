"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { MediaCard } from "@/lib/media-home-api";
import { getMediaTitleEpisodes, type MediaTitleEpisode } from "@/lib/media-home-api";
import styles from "./series-detail-panel.module.css";

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
  seasonCount?: number | null;
  detailsLoaded?: boolean;
};

function parseSeasonNumber(name: string): number {
  const seasonFolder = name.match(/season\s*(\d+)/i);
  if (seasonFolder) return Number(seasonFolder[1]);
  const sxe = name.match(/\bS(\d+)E/i);
  if (sxe) return Number(sxe[1]);
  return 1;
}

const EPISODES_PART_SIZE = 30;

function episodeDisplayNumber(name: string, index: number): number {
  const sxe = name.match(/\bS\d+E(\d+)\b/i);
  if (sxe) return Number(sxe[1]);
  const ep = name.match(/\bEP?\s*(\d+)\b/i);
  if (ep) return Number(ep[1]);
  return index + 1;
}

function buildEpisodeParts(items: MediaTitleEpisode[]) {
  const sorted = [...items].sort(
    (a, b) => episodeDisplayNumber(a.name, a.index) - episodeDisplayNumber(b.name, b.index),
  );
  const parts: { label: string; items: MediaTitleEpisode[] }[] = [];
  for (let i = 0; i < sorted.length; i += EPISODES_PART_SIZE) {
    const chunk = sorted.slice(i, i + EPISODES_PART_SIZE);
    const tail = chunk.at(-1);
    if (!tail) continue;
    const last = episodeDisplayNumber(tail.name, tail.index);
    parts.push({
      label: `Part ${parts.length + 1} - ${last}`,
      items: chunk,
    });
  }
  return parts;
}

function groupBySeason(episodes: MediaTitleEpisode[]) {
  const map = new Map<number, MediaTitleEpisode[]>();
  for (const episode of episodes) {
    const season = parseSeasonNumber(episode.name);
    const list = map.get(season) ?? [];
    list.push(episode);
    map.set(season, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, items]) => ({ season, items }));
}

export function SeriesDetailPanel({
  card,
  details,
  castRow,
  onClose,
  onPlay,
}: {
  card: MediaCard;
  details: MediaDetails | null;
  castRow: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPlay: (episodeIndex?: number) => void;
}) {
  const title = details?.title || card.title;
  const year = details?.year || card.year;
  const poster = details?.posterUrl || card.posterUrl;
  const backdrop = details?.backdropUrl || poster;
  const [episodes, setEpisodes] = useState<MediaTitleEpisode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [season, setSeason] = useState(1);
  const [partIndex, setPartIndex] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEpisodesLoading(true);
    void getMediaTitleEpisodes(card.id)
      .then((rows) => {
        if (cancelled) return;
        setEpisodes(rows);
        const grouped = groupBySeason(rows);
        if (grouped[0]) setSeason(grouped[0].season);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  const seasons = useMemo(() => groupBySeason(episodes), [episodes]);
  const seasonEpisodes = useMemo(
    () => seasons.find((row) => row.season === season)?.items ?? [],
    [season, seasons],
  );

  const episodeParts = useMemo(() => buildEpisodeParts(seasonEpisodes), [seasonEpisodes]);
  const activePart = episodeParts[partIndex] ?? episodeParts[episodeParts.length - 1] ?? null;

  const latestEpisodeIndex = useMemo(() => {
    if (seasonEpisodes.length === 0) return null;
    let best = seasonEpisodes[0];
    let bestNum = episodeDisplayNumber(best.name, best.index);
    for (const episode of seasonEpisodes) {
      const num = episodeDisplayNumber(episode.name, episode.index);
      if (num >= bestNum) {
        bestNum = num;
        best = episode;
      }
    }
    return best.index;
  }, [seasonEpisodes]);

  const gridEpisodes = useMemo(() => {
    if (!activePart) return [];
    return [...activePart.items].sort(
      (a, b) => episodeDisplayNumber(b.name, b.index) - episodeDisplayNumber(a.name, a.index),
    );
  }, [activePart]);

  useEffect(() => {
    setPartIndex(Math.max(0, episodeParts.length - 1));
    setHighlightIndex(null);
  }, [season, episodeParts.length]);

  const seasonLabel =
    card.seasonCount && card.seasonCount > 0
      ? `${card.seasonCount} Season${card.seasonCount === 1 ? "" : "s"}`
      : seasons.length > 1
        ? `${seasons.length} Seasons`
        : seasons.length === 1
          ? "1 Season"
          : null;

  const metaParts = [
    details?.rating ? `★ ${details.rating.toFixed(1)}` : null,
    year ? String(year) : null,
    seasonLabel,
    details?.runtimeMinutes ? `${details.runtimeMinutes} min` : null,
  ].filter(Boolean);

  const detailsPending =
    !details ||
    (!details.detailsLoaded && !details.overview?.trim() && (details.cast?.length ?? 0) === 0);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.scroll}>
          <div className={styles.hero}>
            {backdrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.heroImg} src={backdrop} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <div className={styles.heroShade} aria-hidden />
            <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ×
            </button>
            <div className={styles.heroBody}>
              <div className={styles.poster}>
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" referrerPolicy="no-referrer" />
                ) : null}
              </div>
              <div className={styles.heroCopy}>
                <h2 className={styles.title}>{title}</h2>
                {metaParts.length > 0 ? (
                  <div className={styles.metaRow}>
                    {metaParts.map((part) => (
                      <span key={part} className={styles.metaChip}>
                        {part}
                      </span>
                    ))}
                    {details?.genres?.length ? (
                      <span className={styles.genre}>{details.genres.slice(0, 3).join(" · ")}</span>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <button type="button" className={styles.playBtn} onClick={() => onPlay(0)}>
                    <span aria-hidden>▶</span> Play
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section className={styles.section}>
            {details?.overview ? (
              <p className={styles.overview}>{details.overview}</p>
            ) : detailsPending ? (
              <p className={styles.overviewMuted}>Loading description…</p>
            ) : (
              <p className={styles.overviewMuted}>No description available.</p>
            )}
          </section>

          <section className={`${styles.section} ${styles.episodesSection}`}>
            <div className={styles.episodesHead}>
              <h3>Episodes</h3>
              <div className={styles.episodesTools}>
                {seasonEpisodes.length > 0 ? (
                  <span className={styles.episodeCountPill}>
                    {seasonEpisodes.length} episode{seasonEpisodes.length === 1 ? "" : "s"}
                  </span>
                ) : null}
                {seasons.length > 1 ? (
                  <select
                    className={styles.seasonSelect}
                    value={season}
                    onChange={(event) => setSeason(Number(event.target.value))}
                    aria-label="Season"
                  >
                    {seasons.map((row) => (
                      <option key={row.season} value={row.season}>
                        Season {row.season}
                      </option>
                    ))}
                  </select>
                ) : null}
                {episodeParts.length > 1 ? (
                  <select
                    className={styles.partSelect}
                    value={partIndex}
                    onChange={(event) => setPartIndex(Number(event.target.value))}
                    aria-label="Episode range"
                  >
                    {episodeParts.map((part, index) => (
                      <option key={part.label} value={index}>
                        {part.label}
                      </option>
                    ))}
                  </select>
                ) : episodeParts.length === 1 ? (
                  <span className={styles.partSelectStatic}>{episodeParts[0].label}</span>
                ) : null}
              </div>
            </div>
            {episodesLoading ? (
              <p className={styles.overviewMuted}>Loading episodes…</p>
            ) : seasonEpisodes.length === 0 ? (
              <p className={styles.overviewMuted}>No episodes found on storage.</p>
            ) : (
              <div className={styles.episodeGrid}>
                {gridEpisodes.map((episode) => {
                  const epNum = episodeDisplayNumber(episode.name, episode.index);
                  const isNew = latestEpisodeIndex === episode.index;
                  const isActive =
                    highlightIndex === episode.index ||
                    (highlightIndex == null && isNew);
                  return (
                    <button
                      key={episode.index}
                      type="button"
                      className={`${styles.episodeChip} ${isActive ? styles.episodeChipActive : ""}`}
                      aria-label={`Episode ${epNum}`}
                      onClick={() => {
                        setHighlightIndex(episode.index);
                        onPlay(episode.index);
                      }}
                    >
                      {isNew ? <span className={styles.episodeNewBadge}>NEW</span> : null}
                      EP {epNum}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {details && details.cast.length > 0 ? (
            <section className={styles.castSection}>
              <h3>Cast &amp; Crew</h3>
              {details.directors.length > 0 || details.writers.length > 0 ? (
                <p className={styles.overviewMuted}>
                  {[
                    details.directors.length ? `Directors · ${details.directors.join(", ")}` : "",
                    details.writers.length ? `Writers · ${details.writers.join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <div className={styles.castRow} ref={castRow}>
                {details.cast.map((person) => (
                  <article key={person.name} className={styles.person}>
                    <div className={styles.personPhoto}>
                      {person.profileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.profileUrl} alt="" referrerPolicy="no-referrer" />
                      ) : null}
                    </div>
                    <span className={styles.personName}>{person.name}</span>
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
