"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  ArrowRightIcon,
  BoxIcon,
  ChartIcon,
  LayersIcon,
  ReceiptIcon,
  RefreshIcon,
  TagIcon,
} from "@/components/admin/icons";
import styles from "@/components/admin/movie-server-dashboard.module.css";
import { MovieServerHostMetricsPanel } from "@/components/admin/MovieServerHostMetricsPanel";
import { MovieServerLiveVisitorsPanel } from "@/components/admin/MovieServerLiveVisitorsPanel";
import {
  getMovieServerDashboard,
  type MovieServerDashboardLibrary,
} from "@/lib/media-ops-api";

const CATALOG_STATS = [
  { key: "libraries" as const, label: "Libraries", icon: LayersIcon, tone: "teal" },
  { key: "movies" as const, label: "Total movies", icon: BoxIcon, tone: "cyan" },
  { key: "series" as const, label: "Total series", icon: ChartIcon, tone: "violet" },
  { key: "catalog" as const, label: "Catalog titles", icon: TagIcon, tone: "gold" },
] as const;

function staggerStyle(index: number): CSSProperties {
  return { "--ms-stagger": index } as CSSProperties;
}

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
      heroClassName={styles.pageHero}
      action={
        <button
          type="button"
          className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ""}`}
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
          <RefreshIcon className={styles.refreshIcon} aria-hidden />
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

        <div className={`${styles.stats} ${styles.sectionAnim}`} style={staggerStyle(0)}>
          {CATALOG_STATS.map((item) => {
            const Icon = item.icon;
            const raw = totals[item.key];
            const display =
              loading ? "—" : item.key === "libraries" ? String(raw) : raw.toLocaleString();
            return (
              <div
                key={item.key}
                className={`${styles.stat} ${styles.statCard} ${styles[`statTone_${item.tone}`]}`}
              >
                <span className={styles.statIconWrap} aria-hidden>
                  <Icon className={styles.statIcon} />
                </span>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>{item.label}</span>
                  <span
                    className={`${styles.statValue} ${loading ? "" : styles.statValueReady}`}
                  >
                    {display}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.sectionAnim} style={staggerStyle(1)}>
          <MovieServerHostMetricsPanel />
        </div>

        <div className={styles.sectionAnim} style={staggerStyle(2)}>
          <MovieServerLiveVisitorsPanel />
        </div>

        <div className={`${styles.quickLinks} ${styles.sectionAnim}`} style={staggerStyle(3)}>
          <Link href="/admin/movie-server/plans" className={styles.quickLink}>
            <span className={`${styles.quickLinkIcon} ${styles.quickLinkIconPlans}`}>
              <TagIcon className={styles.quickLinkSvg} aria-hidden />
            </span>
            <span className={styles.quickLinkText}>
              <span className={styles.quickLinkLabel}>Subscription plans</span>
              <span className={styles.quickLinkHint}>Subscription tiers & pricing</span>
            </span>
            <ArrowRightIcon className={styles.quickLinkArrow} aria-hidden />
          </Link>
          <Link href="/admin/movie-server/subscriptions" className={styles.quickLink}>
            <span className={`${styles.quickLinkIcon} ${styles.quickLinkIconSubs}`}>
              <ReceiptIcon className={styles.quickLinkSvg} aria-hidden />
            </span>
            <span className={styles.quickLinkText}>
              <span className={styles.quickLinkLabel}>Subscriptions</span>
              <span className={styles.quickLinkHint}>Grant access & manage subscribers</span>
            </span>
            <ArrowRightIcon className={styles.quickLinkArrow} aria-hidden />
          </Link>
        </div>

        <section
          className={`${styles.panel} ${styles.panelLibraries} ${styles.sectionAnim}`}
          style={staggerStyle(4)}
        >
          <div className={styles.panelHead}>
            <div className={styles.panelTitleBlock}>
              <span className={`${styles.panelIcon} ${styles.panelIconLibraries}`} aria-hidden>
                <LayersIcon className={styles.panelIconSvg} />
              </span>
              <div>
                <h2 className={styles.panelTitle}>Libraries</h2>
                <p className={styles.panelHint}>
                  Counts come from published catalog entries linked to each library folder.
                </p>
              </div>
            </div>
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
            <div className={`${styles.tableWrap} ${styles.tableWrapResponsive}`}>
              <table className={`${styles.table} ${styles.tableResponsive}`}>
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
                      <td className={styles.nameCell} data-label="Library">
                        <div className={styles.libName}>{library.name}</div>
                        <div className={styles.libPath} title={library.rootPath}>
                          {library.rootPath}
                        </div>
                      </td>
                      <td data-label="Type">
                        <span
                          className={`${styles.badge} ${
                            library.kind === "tv" ? styles.badgeTv : styles.badgeMovies
                          } ${library.enabled ? "" : styles.badgeOff}`}
                        >
                          {library.kind === "tv" ? "Series" : "Movies"}
                        </span>
                      </td>
                      <td className={styles.countCell} data-label="Catalog count">
                        {library.catalogCount.toLocaleString()}
                      </td>
                      <td data-label="Scan items">{library.itemCount.toLocaleString()}</td>
                      <td data-label="Unmatched">{library.unmatchedCount.toLocaleString()}</td>
                      <td data-label="Actions" className={styles.actionsCell}>
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
