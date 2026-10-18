"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LayersIcon } from "@/components/admin/icons";
import styles from "@/app/admin/collections/collections-page.module.css";
import { CatalogEditDialog } from "@/components/admin/catalog-edit-dialog";
import type { CatalogBulkAction, CatalogItem, CatalogKind } from "@/lib/catalog-api";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type Props = {
  kind: CatalogKind;
  title: string;
  description: string;
  emptyHint: string;
  yearLabel: "releaseYear" | "firstAirYear";
  showSeasons?: boolean;
  load: (q?: string, page?: number) => Promise<{ items: CatalogItem[]; total: number; page: number; pageCount: number }>;
  bulk: (ids: string[], action: CatalogBulkAction) => Promise<unknown>;
  save: (id: string, body: Record<string, unknown>) => Promise<unknown>;
};

export function CatalogCollectionsPage({
  kind,
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
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [edit, setEdit] = useState<CatalogItem | null>(null);

  const reload = useCallback(async () => {
    const data = await load(q, page);
    setItems(data.items);
    setTotal(data.total);
    setPageCount(data.pageCount);
    if (data.page !== page) setPage(data.page);
  }, [load, q, page]);

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
          <Stat label="Total" value={total} />
          <Stat label="Published" value={stats.published} />
          <Stat label="Available" value={stats.available} />
          <Stat label="Featured" value={stats.featured} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className={styles.searchIconLens} cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                <path className={styles.searchIconHandle} d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search title or original file name…"
              className={styles.searchInput}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search catalog by title or original file name"
            />
            {q ? (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
              >
                ×
              </button>
            ) : null}
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
          <div className={`${styles.tableWrap} ${styles.tableWrapResponsive}`}>
            <table className={`${styles.table} ${styles.tableResponsive}`}>
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
                      <td className={styles.checkboxCell} data-label="">
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
                      <td className={styles.titleColumn} data-label="Title">
                        <div className={styles.titleCell}>
                        <span className={styles.posterThumb}>
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.posterUrl} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <span className={styles.posterFallback}>{initial}</span>
                          )}
                        </span>
                        <span className={styles.titleText}>
                          <span className={styles.titleName}>{item.title}</span>
                          {item.videoFileName || item.videoFileSizeBytes != null ? (
                            <span className={styles.titleFile}>
                              {showSeasons ? (
                                <>
                                  <span className={styles.titleFileLabel}>Original folder: </span>
                                  {item.videoFileName ?? "—"}
                                </>
                              ) : (
                                item.videoFileName ?? "Video file"
                              )}
                              {!showSeasons && item.videoFileSizeBytes != null
                                ? ` · ${formatBytes(item.videoFileSizeBytes)}`
                                : ""}
                            </span>
                          ) : (
                            <span className={styles.titleFileMuted}>
                              {showSeasons ? "No original folder name" : "No linked video file"}
                            </span>
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
                      <td data-label="Year">{year ?? "—"}</td>
                      <td data-label="Status">
                        <span
                          className={`${styles.badge} ${item.published ? styles.badgePublished : styles.badgeDraft}`}
                        >
                          {item.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td data-label="Availability">
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
                      <td className={styles.actionsCell} data-label="Actions">
                        <button type="button" className="dashboard-pro-btn-ghost" onClick={() => setEdit(item)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          {pageCount > 1 ? (
            <div className={styles.pager}>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
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
        <CatalogEditDialog
          kind={kind}
          itemId={edit?.id ?? null}
          open={Boolean(edit)}
          showSeasons={showSeasons}
          onClose={() => setEdit(null)}
          onSave={async (body) => {
            if (!edit) return;
            setBusy(true);
            setError(null);
            try {
              await save(edit.id, body);
              setEdit(null);
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save.");
              throw err;
            } finally {
              setBusy(false);
            }
          }}
        />
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
