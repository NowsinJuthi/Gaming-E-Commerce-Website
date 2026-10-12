"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { LayersIcon } from "@/components/admin/icons";
import styles from "@/components/admin/libraries-page.module.css";
import {
  createMediaLibrary,
  deleteMediaLibrary,
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

  return (
    <AdminPageLayout
      section="Operations"
      title="Media library"
      description="Add a folder on this server, or import a folder from Samba file manager."
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
                Point to an absolute folder on this server. Samba folders are added from Samba file manager.
              </p>
            </div>
          </div>
          <form className={styles.formGrid} onSubmit={(event) => void onCreate(event)}>
            <div className={styles.field}>
              <label htmlFor="lib-name">Name</label>
              <input
                id="lib-name"
                className={styles.inputLike}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
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
            <button type="submit" className="admin-btn-primary" disabled={busy}>
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
              <article key={library.id} className={styles.card}>
                <div className={styles.cardMedia}>
                  <span className={styles.cardMediaFallback} aria-hidden />
                  <div className={styles.cardBadgeRow}>
                    <span className={`${styles.badge} ${styles.badgeKind}`}>{library.kind}</span>
                    <span
                      className={`${styles.badge} ${library.enabled ? styles.badgeOn : styles.badgeOff}`}
                    >
                      {library.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {library.provider === "smb" ? <span className={styles.badge}>Samba</span> : null}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{library.name}</h3>
                  <p className={styles.cardPath}>{library.rootPath}</p>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className="admin-btn-ghost"
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
                      className="admin-btn-ghost"
                      onClick={() => {
                        if (!confirm(`Delete "${library.name}"?`)) return;
                        void deleteMediaLibrary(library.id)
                          .then(reload)
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
        <p className="text-sm text-subtle">
          Browse shares in{" "}
          <Link href="/admin/file-manager" className="text-brand underline">
            Samba file manager
          </Link>
          .
        </p>
      </div>
    </AdminPageLayout>
  );
}
