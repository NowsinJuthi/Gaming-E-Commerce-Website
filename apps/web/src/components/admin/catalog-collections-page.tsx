"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LayersIcon } from "@/components/admin/icons";
import styles from "@/app/admin/collections/collections-page.module.css";
import type { CatalogBulkAction, CatalogItem } from "@/lib/catalog-api";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type Props = {
  title: string;
  description: string;
  emptyHint: string;
  yearLabel: "releaseYear" | "firstAirYear";
  showSeasons?: boolean;
  load: (q?: string) => Promise<{ items: CatalogItem[] }>;
  bulk: (ids: string[], action: CatalogBulkAction) => Promise<unknown>;
  save: (id: string, body: Record<string, unknown>) => Promise<unknown>;
};

export function CatalogCollectionsPage({
  title,
  description,
  emptyHint,
  yearLabel,
  showSeasons = false,
  load,
  bulk,
  save,
}: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [edit, setEdit] = useState<CatalogItem | null>(null);

  const reload = useCallback(async () => {
    const data = await load(q);
    setItems(data.items);
  }, [load, q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      reload()
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Could not load catalog."),
        )
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [reload]);

  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter((item) => item.published).length,
      available: items.filter((item) => item.availability === "available").length,
      featured: items.filter((item) => item.featured).length,
    }),
    [items],
  );
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  async function runBulk(action: CatalogBulkAction) {
    setBusy(true);
    setError(null);
    try {
      await bulk(selected, action);
      setSelected([]);
      setPendingDelete(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageLayout
      section="Movie Server"
      title={title}
      description={description}
      icon={LayersIcon}
      backHref="/admin"
      backLabel="Dashboard"
    >
      <div className={styles.layout}>
        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        <div className={styles.stats}>
          <Stat label="On page" value={stats.total} />
          <Stat label="Published" value={stats.published} />
          <Stat label="Available" value={stats.available} />
          <Stat label="Featured" value={stats.featured} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search titles..."
              className={styles.searchInput}
            />
          </div>
          {selected.length > 0 ? (
            <span className={styles.selectionChip}>{selected.length} selected</span>
          ) : null}
          <div className={styles.actions}>
            <Action disabled={!selected.length || busy} onClick={() => void runBulk("publish")}>
              Publish
            </Action>
            <Action disabled={!selected.length || busy} onClick={() => void runBulk("feature")}>
              Feature
            </Action>
            <Action disabled={!selected.length || busy} onClick={() => void runBulk("trending")}>
              Trending
            </Action>
            <Action disabled={!selected.length || busy} onClick={() => void runBulk("unpublish")}>
              Unpublish
            </Action>
            <Action disabled={!selected.length || busy} onClick={() => setPendingDelete(true)}>
              Delete
            </Action>
          </div>
        </div>
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(event.target.checked ? items.map((item) => item.id) : [])
                    }
                    aria-label="Select all"
                  />
                </th>
                <th>Title</th>
                <th>Year</th>
                <th>Status</th>
                <th>Availability</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const year = yearLabel === "firstAirYear" ? item.firstAirYear : item.releaseYear;
                const initial = item.title.trim().charAt(0).toUpperCase() || "M";
                return (
                  <tr
                    key={item.id}
                    className={selected.includes(item.id) ? styles.rowSelected : undefined}
                  >
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                        aria-label={`Select ${item.title}`}
                      />
                    </td>
                    <td>
                      <div className={styles.titleCell}>
                        <span className={styles.posterThumb}>
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.posterUrl} alt="" />
                          ) : (
                            <span className={styles.posterFallback}>{initial}</span>
                          )}
                        </span>
                        <span className={styles.titleText}>
                          <span className={styles.titleName}>{item.title}</span>
                          {item.videoFileName || item.videoFileSizeBytes != null ? (
                            <span className={styles.titleFile}>
                              {item.videoFileName ?? "Video file"}
                              {item.videoFileSizeBytes != null
                                ? ` · ${formatBytes(item.videoFileSizeBytes)}`
                                : ""}
                            </span>
                          ) : (
                            <span className={styles.titleFileMuted}>No linked video file</span>
                          )}
                          <span className={styles.titleMeta}>
                            {item.featured ? "Featured" : "Catalog"}
                            {item.trending ? " · Trending" : ""}
                            {showSeasons && item.seasonCount
                              ? ` · ${item.seasonCount} seasons`
                              : ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>{year}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${item.published ? styles.badgePublished : styles.badgeDraft}`}
                      >
                        {item.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          item.availability === "available"
                            ? styles.badgeAvailable
                            : styles.badgeUnavailable
                        }`}
                      >
                        {item.availability}
                      </span>
                    </td>
                    <td className="text-right">
                      <button type="button" className="dashboard-pro-btn-ghost" onClick={() => setEdit(item)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading ? (
            <p className="px-4 py-8 text-sm text-subtle">Loading catalog...</p>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {title.startsWith("Series") ? "No series found" : "No movies found"}
              </p>
              <p className={styles.emptyText}>{q ? "Try a different search." : emptyHint}</p>
            </div>
          ) : null}
        </div>
        {pendingDelete ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
            <p className="font-semibold">Delete selected titles?</p>
            <p className="mt-1 text-subtle">This cannot be undone from the admin UI.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="dashboard-pro-btn" disabled={busy} onClick={() => void runBulk("delete")}>
                Delete
              </button>
              <button type="button" className="dashboard-pro-btn-ghost" onClick={() => setPendingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {edit ? (
          <EditDialog
            item={edit}
            showSeasons={showSeasons}
            busy={busy}
            onClose={() => setEdit(null)}
            onSave={async (body) => {
              setBusy(true);
              setError(null);
              try {
                await save(edit.id, body);
                setEdit(null);
                await reload();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </div>
    </AdminPageLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon} aria-hidden />
      <span>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </span>
    </div>
  );
}

function Action({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dashboard-pro-btn-ghost" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function EditDialog({
  item,
  showSeasons,
  busy,
  onClose,
  onSave,
}: {
  item: CatalogItem;
  showSeasons: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [year, setYear] = useState(String(item.releaseYear));
  const [posterUrl, setPosterUrl] = useState(item.posterUrl ?? "");
  const [published, setPublished] = useState(item.published);
  const [featured, setFeatured] = useState(item.featured);
  const [trending, setTrending] = useState(item.trending);
  const [availability, setAvailability] = useState(item.availability);
  const [seasonCount, setSeasonCount] = useState(String(item.seasonCount ?? ""));

  return (
    <div className="rounded-xl border border-border/50 bg-elevated p-4">
      <h2 className="text-base font-semibold">Edit {item.title}</h2>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            title,
            year: Number(year),
            posterUrl: posterUrl.trim() || null,
            published,
            featured,
            trending,
            availability,
            ...(showSeasons
              ? { seasonCount: seasonCount.trim() ? Number(seasonCount) : null }
              : {}),
          });
        }}
      >
        <label className="text-xs">
          Title
          <input className="admin-input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="text-xs">
          Year
          <input className="admin-input mt-1 w-full" value={year} onChange={(e) => setYear(e.target.value)} required />
        </label>
        <label className="text-xs sm:col-span-2">
          Poster URL
          <input className="admin-input mt-1 w-full" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
        </label>
        {showSeasons ? (
          <label className="text-xs">
            Seasons
            <input className="admin-input mt-1 w-full" value={seasonCount} onChange={(e) => setSeasonCount(e.target.value)} />
          </label>
        ) : null}
        <label className="text-xs">
          Availability
          <select
            className="admin-input mt-1 w-full"
            value={availability}
            onChange={(e) => setAvailability(e.target.value as CatalogItem["availability"])}
          >
            <option value="available">available</option>
            <option value="unavailable">unavailable</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={trending} onChange={(e) => setTrending(e.target.checked)} />
          Trending
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="dashboard-pro-btn" disabled={busy}>
            Save
          </button>
          <button type="button" className="dashboard-pro-btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
