"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LayersIcon } from "@/components/admin/icons";
import styles from "@/components/admin/libraries-page.module.css";
import {
  deleteMediaLibrary,
  indexMediaLibrary,
  listLibraryItems,
  listMediaLibraries,
  type LibraryIndexedItem,
  updateMediaLibrary,
  type AdminMediaLibrary,
  type MediaLibraryKind,
} from "@/lib/media-ops-api";

function ScanResult({
  busy,
  title,
  matched,
  missing,
  unmatched,
  logs,
  onClose,
}: {
  busy: boolean;
  title: string;
  matched: number;
  missing: number;
  unmatched: number;
  logs: string[];
  onClose: () => void;
}) {
  const total = matched + missing + unmatched;
  const matchedPct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const stats = [
    { label: "Matched", value: matched, tone: "good" as const },
    { label: "Missing", value: missing, tone: "warn" as const },
    { label: "Unmatched", value: unmatched, tone: "gap" as const },
  ];

  return (
    <section className={`${styles.scanCard} ${busy ? styles.scanCardBusy : styles.scanCardDone}`} aria-live="polite">
      <div className={styles.scanGlow} aria-hidden />
      <div className={styles.scanHead}>
        <div className={styles.scanMark} aria-hidden>
          {busy ? (
            <span className={styles.scanSpin} />
          ) : (
            <svg className={styles.scanCheck} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.4 2.4L16.2 9" />
            </svg>
          )}
        </div>
        <div className={styles.scanCopy}>
          <p className={styles.scanKicker}>{busy ? "Scanning" : "Completed"}</p>
          <h2 className={styles.scanTitle}>{title}</h2>
        </div>
        <button type="button" className={styles.headerBtn} onClick={onClose}>
          Close
        </button>
      </div>
      <div className={styles.scanStats}>
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`${styles.scanStat} ${
              stat.tone === "good" ? styles.scanStat_good : stat.tone === "warn" ? styles.scanStat_warn : styles.scanStat_gap
            }`}
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            <span>{stat.label}</span>
            <strong>{busy ? "—" : stat.value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.scanBar} aria-hidden>
        <div className={busy ? styles.scanFillBusy : styles.scanFill} style={busy ? undefined : { width: `${matchedPct}%` }} />
      </div>
      <p className={styles.scanMeterLabel}>
        {busy ? "Reading folders and matching posters…" : `${matchedPct}% matched${total > 0 ? ` of ${total}` : ""}`}
      </p>
      <div className={styles.scanLogs}>
        {logs.length === 0 ? (
          <div>Waiting for scan output…</div>
        ) : (
          logs.map((line, index) => (
            <div key={`${index}-${line}`} style={{ animationDelay: `${280 + index * 70}ms` }}>
              {line}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function AdminLibrariesPage() {
  const [libraries, setLibraries] = useState<AdminMediaLibrary[]>([]);
  const [totals, setTotals] = useState({ items: 0, missing: 0, unmatched: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminMediaLibrary | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<MediaLibraryKind>("movies");
  const [editRootPath, setEditRootPath] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [scanStats, setScanStats] = useState({ matched: 0, missing: 0, unmatched: 0 });
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [items, setItems] = useState<LibraryIndexedItem[]>([]);

  const reload = useCallback(async () => {
    const data = await listMediaLibraries();
    setLibraries(data.libraries);
    setTotals(data.totals);
  }, []);

  useEffect(() => {
    reload()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load libraries."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  async function runScan(label: string, targets: AdminMediaLibrary[]) {
    setBusy(true);
    setError(null);
    setScanNote(label);
    setScanLogs(["Reading folders and matching posters…"]);
    try {
      const results = [];
      for (const library of targets) {
        results.push(await indexMediaLibrary(library.id));
      }
      setScanLogs(results.flatMap((result) => result.logs));
      setScanStats({
        matched: results.reduce((sum, result) => sum + result.matched, 0),
        missing: 0,
        unmatched: results.reduce((sum, result) => sum + result.unmatched, 0),
      });
      setScanNote(`${label} completed`);
      await reload();
      if (selectedId) {
        const data = await listLibraryItems(selectedId);
        setItems(data.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan libraries.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(library: AdminMediaLibrary) {
    setEditing(library);
    setEditName(library.name);
    setEditKind(library.kind);
    setEditRootPath(library.rootPath);
    setError(null);
  }

  const selected = libraries.find((library) => library.id === selectedId) ?? null;

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Media libraries"
      description="Connect folders, scan media, and keep posters in sync from local artwork or TMDB."
      icon={LayersIcon}
      action={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={styles.headerBtn} disabled={busy} onClick={() => void runScan("Full scan", libraries)}>
            Full scan
          </button>
          <button type="button" className={styles.headerBtn} disabled={busy} onClick={() => void runScan("Last 24h scan", libraries)}>
            Last 24h Scan
          </button>
        </div>
      }
    >
      <div className={styles.layout}>
        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        ) : null}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Libraries</span>
            <span className={styles.statValue}>{libraries.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Indexed files</span>
            <span className={styles.statValue}>{totals.items}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Missing</span>
            <span className={styles.statValue}>{totals.missing}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Unmatched</span>
            <span className={styles.statValue}>{totals.unmatched}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-subtle">Loading libraries…</p>
        ) : libraries.length === 0 ? (
          <div className={styles.empty}>
            <p>No libraries yet. Import a folder from Samba file manager.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {libraries.map((library) => (
              <article
                key={library.id}
                className={`${styles.card} ${selectedId === library.id ? styles.cardSelected : ""}`}
              >
                <div className={styles.cardMedia}>
                  {library.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={library.imageUrl} alt="" />
                  ) : (
                    <span className={styles.cardMediaFallback} aria-hidden />
                  )}
                  <div className={styles.cardBadgeRow}>
                    <span className={`${styles.badge} ${styles.badgeKind}`}>
                      {library.kind === "tv" ? "Tv" : "Movies"}
                    </span>
                    <span className={`${styles.badge} ${library.enabled ? styles.badgeOn : styles.badgeOff}`}>
                      {library.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {library.provider === "smb" ? <span className={styles.badge}>Samba</span> : null}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div>
                    <h3 className={styles.cardTitle}>{library.name}</h3>
                    <p className={styles.cardPath} title={library.rootPath}>
                      {library.rootPath}
                    </p>
                    {library.provider === "smb" && library.smbShare ? (
                      <p className={styles.cardMeta}>{library.smbShare}</p>
                    ) : null}
                  </div>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Items</span>
                      <span className={styles.metricValue}>{library.itemCount}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Missing</span>
                      <span className={styles.metricValue}>{library.missingCount}</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Gaps</span>
                      <span className={styles.metricValue}>{library.unmatchedCount}</span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" onClick={() => openEdit(library)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(library.id);
                        void listLibraryItems(library.id)
                          .then((data) => setItems(data.items))
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Could not load items."),
                          );
                      }}
                    >
                      Items
                    </button>
                    <button type="button" disabled={busy} onClick={() => void runScan(`Full scan · ${library.name}`, [library])}>
                      Full scan
                    </button>
                    <button type="button" disabled={busy} onClick={() => void runScan(`Last 24h scan · ${library.name}`, [library])}>
                      Last 24h Scan
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void updateMediaLibrary(library.id, { enabled: !library.enabled })
                          .then(reload)
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Update failed."),
                          )
                      }
                    >
                      {library.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => {
                        if (!confirm(`Delete library “${library.name}”?`)) return;
                        void deleteMediaLibrary(library.id)
                          .then(async () => {
                            if (selectedId === library.id) setSelectedId(null);
                            if (editing?.id === library.id) setEditing(null);
                            await reload();
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Delete failed."),
                          );
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {scanNote ? (
          <ScanResult
            busy={busy}
            title={scanNote}
            matched={scanStats.matched}
            missing={scanStats.missing}
            unmatched={scanStats.unmatched}
            logs={scanLogs}
            onClose={() => setScanNote(null)}
          />
        ) : null}

        {editing ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Edit library</h2>
                <p className={styles.panelHint}>Update name, content type, and media directory.</p>
              </div>
              <button type="button" className={styles.headerBtn} onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <form
              className={styles.editGrid}
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                setError(null);
                void updateMediaLibrary(editing.id, {
                  name: editName.trim(),
                  kind: editKind,
                  ...(editing.provider === "smb" ? {} : { rootPath: editRootPath.trim() }),
                })
                  .then(async () => {
                    setEditing(null);
                    await reload();
                  })
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : "Could not update library."),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <div className={styles.preview}>
                {editing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.imageUrl} alt="" />
                ) : (
                  <div className={styles.previewEmpty}>No picture</div>
                )}
              </div>
              <div className="grid gap-4">
                <div className={styles.field}>
                  <label htmlFor="edit-lib-name">Name</label>
                  <input id="edit-lib-name" className={styles.inputLike} value={editName} onChange={(event) => setEditName(event.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-lib-kind">Content type</label>
                  <select
                    id="edit-lib-kind"
                    className={styles.select}
                    value={editKind}
                    onChange={(event) => setEditKind(event.target.value as MediaLibraryKind)}
                  >
                    <option value="movies">Movies</option>
                    <option value="tv">TV series</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-lib-root">Media directory</label>
                  <input
                    id="edit-lib-root"
                    className={styles.inputLike}
                    value={editRootPath}
                    onChange={(event) => setEditRootPath(event.target.value)}
                    required={editing.provider !== "smb"}
                    disabled={editing.provider === "smb"}
                    readOnly={editing.provider === "smb"}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={styles.submitBtn} disabled={busy}>
                    {busy ? "Saving..." : "Save changes"}
                  </button>
                  <button type="button" className={styles.headerBtn} onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        {selected ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Library items</h2>
                <p className={styles.panelHint}>
                  {selected.itemCount} file{selected.itemCount === 1 ? "" : "s"} in {selected.name}.
                </p>
              </div>
              <button type="button" className={styles.headerBtn} onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <div className={styles.itemsWrap}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Match</th>
                    <th>Resolution</th>
                    <th>Codec</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.fileName}</td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            item.status === "matched" ? styles.statusMatched : styles.statusMissing
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>{item.match}</td>
                      <td>{item.resolution}</td>
                      <td>{item.codec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 ? <p className="px-4 py-8 text-sm text-subtle">No items indexed yet.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </AdminPageLayout>
  );
}
