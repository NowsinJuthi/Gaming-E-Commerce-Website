"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getLiveAnalyticsSnapshot,
  parseLiveSnapshot,
  type LiveAnalyticsSnapshot,
} from "@/lib/live-analytics-api";
import { getLiveAnalyticsSocket } from "@/lib/live-analytics-socket";
import { PulseIcon } from "@/components/admin/icons";
import styles from "@/components/admin/movie-server-dashboard.module.css";

function formatWhen(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MovieServerLiveVisitorsPanel() {
  const [snapshot, setSnapshot] = useState<LiveAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const data = await getLiveAnalyticsSnapshot();
    setSnapshot(data);
  }, []);

  useEffect(() => {
    void reload()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load live analytics."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    const socket = getLiveAnalyticsSocket();
    const onSnapshot = (payload: unknown) => {
      setSnapshot(parseLiveSnapshot(payload));
      setLoading(false);
      setError(null);
    };
    socket.on("live:snapshot", onSnapshot);
    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      socket.off("live:snapshot", onSnapshot);
    };
  }, []);

  const visitors = snapshot?.visitors ?? [];
  const mediaSessions = snapshot?.mediaSessions ?? [];

  return (
    <section className={`${styles.panel} ${styles.panelLive}`}>
      <div className={styles.panelHead}>
        <div className={styles.hostHeadRow}>
          <div className={styles.panelTitleBlock}>
            <span className={`${styles.panelIcon} ${styles.panelIconLive}`} aria-hidden>
              <PulseIcon className={styles.panelIconSvg} />
            </span>
            <div>
              <h2 className={styles.panelTitle}>Live visitors & playback</h2>
              <p className={styles.panelHint}>
                Real-time site presence and who is watching movies or series right now.
              </p>
            </div>
          </div>
          <span className={styles.liveBadge} title={snapshot ? formatWhen(snapshot.updatedAt) : ""}>
            <span className={styles.liveDot} aria-hidden />
            Live
          </span>
        </div>
      </div>

      <div className={styles.hostBody}>
        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        <div className={styles.liveStatRow}>
          <div className={styles.liveStat}>
            <span className={styles.statLabel}>Active visitors</span>
            <span className={`${styles.statValue} ${styles.liveStatValueBrand}`}>
              {loading && !snapshot ? "—" : snapshot?.visitorCount ?? 0}
            </span>
            <span className={styles.meterHint}>
              Updated {snapshot ? formatWhen(snapshot.updatedAt) : "—"}
            </span>
          </div>
          <div className={styles.liveStat}>
            <span className={styles.statLabel}>Watching now</span>
            <span className={`${styles.statValue} ${styles.liveStatValueGreen}`}>
              {loading && !snapshot ? "—" : mediaSessions.length}
            </span>
            <span className={styles.meterHint}>Movies & series players</span>
          </div>
        </div>

        <div className={styles.liveSection}>
          <h3 className={styles.liveSectionTitle}>Now watching</h3>
          {mediaSessions.length === 0 ? (
            <p className={styles.liveEmpty}>No active playback sessions.</p>
          ) : (
            <div className={`${styles.tableWrap} ${styles.tableWrapResponsive}`}>
              <table className={`${styles.table} ${styles.tableResponsive}`}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Title</th>
                    <th>Episode</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaSessions.map((row) => (
                    <tr key={row.visitorKey}>
                      <td data-label="Customer">{row.label}</td>
                      <td data-label="Title">
                        <Link
                          href={`/media/watch/${row.titleId}`}
                          className={styles.linkBtn}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.titleName}
                        </Link>
                      </td>
                      <td className={styles.meterHint} data-label="Episode">
                        {row.episodeName ?? "—"}
                      </td>
                      <td className={styles.tabularMuted} data-label="Last seen">
                        {formatWhen(row.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.liveSection}>
          <h3 className={styles.liveSectionTitle}>Active pages</h3>
          {visitors.length === 0 ? (
            <p className={styles.liveEmpty}>No active visitors in the last ~90 seconds.</p>
          ) : (
            <div className={`${styles.tableWrap} ${styles.tableWrapResponsive}`}>
              <table className={`${styles.table} ${styles.tableResponsive}`}>
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Page</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((row) => (
                    <tr key={row.visitorKey}>
                      <td data-label="Visitor">{row.label}</td>
                      <td data-label="Page" className={styles.nameCell}>
                        <div className={styles.libName}>{row.pathLabel?.trim() || row.path}</div>
                        {row.pathLabel?.trim() && row.path !== row.pathLabel ? (
                          <div className={styles.libPath}>{row.path}</div>
                        ) : null}
                      </td>
                      <td className={styles.tabularMuted} data-label="Last seen">
                        {formatWhen(row.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
