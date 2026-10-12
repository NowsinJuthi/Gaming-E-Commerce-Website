"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LayersIcon } from "@/components/admin/icons";
import styles from "@/components/admin/libraries-page.module.css";
import {
  createMediaLibrary,
  deleteMediaLibrary,
  indexMediaLibrary,
  listMediaLibraries,
  updateMediaLibrary,
  type AdminMediaLibrary,
  type MediaLibraryKind,
} from "@/lib/media-ops-api";

export default function AdminLibrariesPage() {
  const [libraries, setLibraries] = useState<AdminMediaLibrary[]>([]);
  const [totals, setTotals] = useState({ items: 0, missing: 0, unmatched: 0 });
  const [name, setName] = useState("Movies");
  const [kind, setKind] = useState<MediaLibraryKind>("movies");
  const [rootPath, setRootPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminMediaLibrary | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<MediaLibraryKind>("movies");
  const [editRootPath, setEditRootPath] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);

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

  function openEdit(library: AdminMediaLibrary) {
    setEditing(library);
    setEditName(library.name);
    setEditKind(library.kind);
    setEditRootPath(library.rootPath);
    setError(null);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMediaLibrary({ name, kind, rootPath });
      setRootPath("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add library.");
    } finally {
      setBusy(false);
    }
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
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => {
              setScanNote("Full scan");
              void Promise.all(libraries.map((library) => indexMediaLibrary(library.id)))
                .then(async () => {
                  setScanNote("Full scan completed");
                  await reload();
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Could not scan libraries."),
                );
            }}
          >
            Full scan
          </button>
          <button type="button" className={styles.headerBtn} onClick={() => setScanNote("Last 24h scan")}>
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

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Add library</h2>
              <p className={styles.panelHint}>
                Point to an absolute folder on this server. Movies and series import on scan.
              </p>
            </div>
          </div>
          <form className={styles.formGrid} onSubmit={(event) => void onCreate(event)}>
            <div className={styles.field}>
              <label htmlFor="lib-name">Name</label>
              <input id="lib-name" className={styles.inputLike} value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="lib-kind">Kind</label>
              <select
                id="lib-kind"
                className={styles.select}
                value={kind}
                onChange={(event) => setKind(event.target.value as MediaLibraryKind)}
              >
                <option value="movies">Movies</option>
                <option value="tv">TV</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="lib-root">Media directory</label>
              <input
                id="lib-root"
                className={styles.inputLike}
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
                placeholder="D:\Media\Movies"
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Adding..." : "Add library"}
            </button>
          </form>
        </section>

        {loading ? (
          <p className="text-sm text-subtle">Loading libraries…</p>
        ) : libraries.length === 0 ? (
          <div className={styles.empty}>
            <p>No libraries yet. Add a folder above or import one from Samba file manager.</p>
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
                    <button type="button" onClick={() => setSelectedId(library.id)}>
                      Items
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScanNote(`Full scan · ${library.name}`);
                        void indexMediaLibrary(library.id)
                          .then(async (result) => {
                            setScanNote(`Full scan completed · ${result.indexed} titles`);
                            await reload();
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Could not scan library."),
                          );
                      }}
                    >
                      Full scan
                    </button>
                    <button type="button" onClick={() => setScanNote(`Last 24h scan · ${library.name}`)}>
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
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>{scanNote}</h2>
                <p className={styles.panelHint}>Matched 0 · Missing 0 · Duplicates 0 · Errors 0</p>
              </div>
              <button type="button" className={styles.headerBtn} onClick={() => setScanNote(null)}>
                Close
              </button>
            </div>
            <div className={styles.logs}>
              <div>Reading library folders into Movie collections and Series collections.</div>
            </div>
          </section>
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
                <tbody />
              </table>
              <p className="px-4 py-8 text-sm text-subtle">No items indexed yet.</p>
            </div>
          </section>
        ) : null}
      </div>
    </AdminPageLayout>
  );
}
