"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./catalog-edit-dialog.module.css";
import {
  applyCatalogFromTmdb,
  getCatalogDetail,
  uploadCatalogPoster,
  type AdminCatalogDetail,
  type CatalogKind,
} from "@/lib/catalog-api";

type SaveBody = Record<string, unknown>;

export function CatalogEditDialog({
  kind,
  itemId,
  open,
  showSeasons,
  onClose,
  onSave,
}: {
  kind: CatalogKind;
  itemId: string | null;
  open: boolean;
  showSeasons?: boolean;
  onClose: () => void;
  onSave: (body: SaveBody) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<AdminCatalogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tmdbCode, setTmdbCode] = useState("");
  const [updateArtwork, setUpdateArtwork] = useState(true);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [overview, setOverview] = useState("");
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [rating, setRating] = useState("");
  const [genres, setGenres] = useState("");
  const [availability, setAvailability] = useState<"available" | "unavailable">("available");
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);
  const [seasonCount, setSeasonCount] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !itemId) {
      setDetail(null);
      return;
    }
    setError(null);
    setTmdbCode("");
    setUpdateArtwork(true);
    setLoading(true);
    getCatalogDetail(kind, itemId)
      .then((data) => {
        setDetail(data);
        setTitle(data.title);
        setYear(String(data.releaseYear));
        setOverview(data.overview ?? "");
        setRuntimeMinutes(data.runtimeMinutes != null ? String(data.runtimeMinutes) : "");
        setRating(data.rating != null ? String(data.rating) : "");
        setGenres((data.genres ?? []).join(", "));
        setAvailability(data.availability);
        setPublished(data.published);
        setFeatured(data.featured);
        setTrending(data.trending);
        setSeasonCount(data.seasonCount != null ? String(data.seasonCount) : "");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load title.");
      })
      .finally(() => setLoading(false));
  }, [open, itemId, kind]);

  async function runTmdb() {
    if (!itemId) return;
    const parsed = Number(tmdbCode.trim().replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Enter a valid TMDB id (numbers only).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await applyCatalogFromTmdb(kind, itemId, parsed, updateArtwork);
      setDetail(data);
      setTitle(data.title);
      setYear(String(data.releaseYear));
      setOverview(data.overview ?? "");
      setRuntimeMinutes(data.runtimeMinutes != null ? String(data.runtimeMinutes) : "");
      setRating(data.rating != null ? String(data.rating) : "");
      setGenres((data.genres ?? []).join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "TMDB update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runPosterUpload(file: File) {
    if (!itemId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await uploadCatalogPoster(kind, itemId, file);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poster upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open || !itemId) return null;

  const label = kind === "series" ? "series" : "movie";
  const posterUrl = detail?.posterUrl ?? null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-edit-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgb(3,26,34)] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-primary/15 via-transparent to-transparent px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Edit {label}
            </p>
            <h2 id="catalog-edit-title" className="mt-1 truncate text-xl font-semibold">
              {detail?.title ?? title ?? "Loading..."}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update metadata and media tracks without leaving collections.
            </p>
          </div>
          <button type="button" className="dashboard-pro-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="brand-scrollbar space-y-6 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-subtle">Loading...</p>
          ) : (
            <>
              <section className={styles.posterPanel}>
                <div className={styles.posterFrame}>
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterUrl} alt="" className={styles.posterImage} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.posterEmpty}>No poster</div>
                  )}
                </div>
                <div className={styles.posterMeta}>
                  <h3 className={styles.posterMetaTitle}>{kind === "series" ? "Series poster" : "Movie poster"}</h3>
                  <p className={styles.posterMetaText}>
                    Current poster preview. Upload a new image or pull artwork from TMDB.
                  </p>
                  <div className={styles.posterActions}>
                    <label className={styles.fileButton}>
                      {busy ? "Uploading..." : "Upload poster"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void runPosterUpload(file);
                        }}
                      />
                    </label>
                    {posterUrl ? (
                      <a href={posterUrl} target="_blank" rel="noreferrer" className={styles.fileButton}>
                        Open full size
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={styles.tmdbPanel}>
                <div>
                  <h3 className={styles.tmdbTitle}>Update from TMDB</h3>
                  <p className={styles.tmdbHint}>
                    Paste the TMDB {label} id (example:{" "}
                    <span className="text-foreground/80">912649</span> from themoviedb.org/{label}/912649). This fills
                    title, description, year, runtime, genres, cast, and ratings.
                  </p>
                </div>
                <div className={styles.tmdbRow}>
                  <div className={`${styles.field} min-w-0 flex-1`}>
                    <label htmlFor="catalog-tmdb-code" className={styles.label}>
                      TMDB {label} code
                    </label>
                    <input
                      id="catalog-tmdb-code"
                      className={styles.control}
                      inputMode="numeric"
                      placeholder="e.g. 912649"
                      value={tmdbCode}
                      onChange={(event) => setTmdbCode(event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="dashboard-pro-btn h-10 shrink-0 px-4"
                    disabled={busy || !tmdbCode.trim()}
                    onClick={() => void runTmdb()}
                  >
                    {busy ? "Updating..." : "Update from TMDB"}
                  </button>
                </div>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={updateArtwork}
                    onChange={(event) => setUpdateArtwork(event.target.checked)}
                  />
                  Also download poster & backdrop from TMDB
                </label>
              </section>

              <form
                className={styles.formGrid}
                onSubmit={(event) => {
                  event.preventDefault();
                  const genreList = genres
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .slice(0, 12);
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await onSave({
                        title: title.trim(),
                        year: Number(year),
                        overview: overview.trim() || null,
                        runtimeMinutes: runtimeMinutes.trim() ? Number(runtimeMinutes) : null,
                        rating: rating.trim() ? Number(rating) : null,
                        genres: genreList,
                        availability,
                        published,
                        featured,
                        trending,
                        ...(showSeasons
                          ? { seasonCount: seasonCount.trim() ? Number(seasonCount) : null }
                          : {}),
                      });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Save failed.");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-title">
                    Title
                  </label>
                  <input
                    id="catalog-title"
                    className={styles.control}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-year">
                    Year
                  </label>
                  <input
                    id="catalog-year"
                    className={styles.control}
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.span2}`}>
                  <label className={styles.label} htmlFor="catalog-overview">
                    Description
                  </label>
                  <textarea
                    id="catalog-overview"
                    className={styles.textarea}
                    value={overview}
                    onChange={(event) => setOverview(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-runtime">
                    Runtime (min)
                  </label>
                  <input
                    id="catalog-runtime"
                    className={styles.control}
                    value={runtimeMinutes}
                    onChange={(event) => setRuntimeMinutes(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-rating">
                    Rating
                  </label>
                  <input
                    id="catalog-rating"
                    className={styles.control}
                    value={rating}
                    onChange={(event) => setRating(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-genres">
                    Genres
                  </label>
                  <input
                    id="catalog-genres"
                    className={styles.control}
                    placeholder="thriller, action"
                    value={genres}
                    onChange={(event) => setGenres(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="catalog-availability">
                    Availability
                  </label>
                  <select
                    id="catalog-availability"
                    className={styles.select}
                    value={availability}
                    onChange={(event) =>
                      setAvailability(event.target.value as "available" | "unavailable")
                    }
                  >
                    <option value="available">available</option>
                    <option value="unavailable">unavailable</option>
                  </select>
                </div>
                {showSeasons ? (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="catalog-seasons">
                      Seasons
                    </label>
                    <input
                      id="catalog-seasons"
                      className={styles.control}
                      value={seasonCount}
                      onChange={(event) => setSeasonCount(event.target.value)}
                    />
                  </div>
                ) : null}
                <div className={`${styles.checkRow} ${styles.span2}`}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                    Published
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                    Featured
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={trending} onChange={(e) => setTrending(e.target.checked)} />
                    Trending
                  </label>
                </div>
                <div className={`flex gap-2 ${styles.span2}`}>
                  <button type="submit" className="dashboard-pro-btn" disabled={busy}>
                    Save changes
                  </button>
                  <button type="button" className="dashboard-pro-btn-ghost" onClick={onClose}>
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
