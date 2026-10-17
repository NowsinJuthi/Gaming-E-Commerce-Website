"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ChartIcon } from "@/components/admin/icons";
import styles from "@/components/admin/movie-server-dashboard.module.css";
import { MovieServerHostMetricsPanel } from "@/components/admin/MovieServerHostMetricsPanel";
import { MovieServerLiveVisitorsPanel } from "@/components/admin/MovieServerLiveVisitorsPanel";
import {
  getMovieServerDashboard,
  type MovieServerDashboardLibrary,
} from "@/lib/media-ops-api";

export default function MovieServerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    libraries: 0,
    movies: 0,
    series: 0,
    catalog: 0,
  });
  const [libraries, setLibraries] = useState<MovieServerDashboardLibrary[]>([]);

  const reload = useCallback(async () => {
    setError(null);
    const data = await getMovieServerDashboard();
    setTotals(data.totals);
    setLibraries(data.libraries);
  }, []);

  useEffect(() => {
    reload()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load dashboard."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Dashboard"
      description="Catalog overview, live visitors, playback, and server resources in one place."
      icon={ChartIcon}
      action={
        <button
          type="button"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void reload()
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not refresh."),
              )
              .finally(() => setLoading(false));
          }}
        >
          Refresh
        </button>
      }
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
            <span className={styles.statValue}>{loading ? "—" : totals.libraries}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total movies</span>
            <span className={styles.statValue}>{loading ? "—" : totals.movies.toLocaleString()}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total series</span>
            <span className={styles.statValue}>{loading ? "—" : totals.series.toLocaleString()}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Catalog titles</span>
            <span className={styles.statValue}>{loading ? "—" : totals.catalog.toLocaleString()}</span>
          </div>
        </div>

        <MovieServerLiveVisitorsPanel />

        <MovieServerHostMetricsPanel />

        <div className={styles.quickLinks}>
          <Link href="/admin/movie-server/plans" className={styles.quickLink}>
            <span className={styles.quickLinkLabel}>Subscription plans</span>
            <span className={styles.quickLinkHint}>Subscription tiers & pricing</span>
          </Link>
          <Link href="/admin/movie-server/subscriptions" className={styles.quickLink}>
            <span className={styles.quickLinkLabel}>Subscriptions</span>
            <span className={styles.quickLinkHint}>Grant access & manage subscribers</span>
          </Link>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Libraries</h2>
            <p className={styles.panelHint}>
              Counts come from published catalog entries linked to each library folder.
            </p>
          </div>
          {loading ? (
            <p className={styles.empty}>Loading…</p>
          ) : libraries.length === 0 ? (
            <p className={styles.empty}>
              No media libraries yet.{" "}
              <Link href="/admin/file-manager">Connect Samba</Link> or{" "}
              <Link href="/admin/libraries">add a library</Link>.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Library</th>
                    <th>Type</th>
                    <th>Movie / series count</th>
                    <th>Last scan items</th>
                    <th>Unmatched</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {libraries.map((library) => (
                    <tr key={library.id}>
                      <td className={styles.nameCell}>
                        <div className={styles.libName}>{library.name}</div>
                        <div className={styles.libPath} title={library.rootPath}>
                          {library.rootPath}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            library.kind === "tv" ? styles.badgeTv : styles.badgeMovies
                          } ${library.enabled ? "" : styles.badgeOff}`}
                        >
                          {library.kind === "tv" ? "Series" : "Movies"}
                        </span>
                      </td>
                      <td className={styles.countCell}>{library.catalogCount.toLocaleString()}</td>
                      <td>{library.itemCount.toLocaleString()}</td>
                      <td>{library.unmatchedCount.toLocaleString()}</td>
                      <td>
                        <Link href="/admin/libraries" className={styles.linkBtn}>
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminPageLayout>
  );
}
