"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudUploadIcon,
  GridIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  getMovieServerHostMetrics,
  type MovieServerHostMetrics,
} from "@/lib/media-ops-api";
import styles from "@/components/admin/movie-server-dashboard.module.css";

const POLL_MS = 5000;
const HISTORY_LEN = 24;

type Sample = { at: number; cpu: number | null; mem: number };

function formatGb(gb: number): string {
  if (gb >= 100) return `${Math.round(gb)} GB`;
  return `${gb.toFixed(1)} GB`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Meter({
  label,
  value,
  max = 100,
  hint,
  tone = "teal",
}: {
  label: string;
  value: number | null;
  max?: number;
  hint?: string;
  tone?: "teal" | "violet" | "amber";
}) {
  const pct =
    value == null || !Number.isFinite(value)
      ? 0
      : Math.min(100, Math.max(0, (value / max) * 100));
  const display =
    value == null ? "…" : max === 100 ? `${value.toFixed(1)}%` : String(value);

  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterValue}>{display}</span>
      </div>
      <div className={styles.meterTrack} aria-hidden>
        <div
          className={`${styles.meterFill} ${styles[`meterFill_${tone}`]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className={styles.meterHint}>{hint}</p> : null}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 280;
  const h = 48;
  if (values.length < 2) {
    return <div className={styles.sparkEmpty}>Collecting samples…</div>;
  }
  const peak = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - 6 - (v / peak) * (h - 12);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={styles.sparkSvg} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

export function MovieServerHostMetricsPanel() {
  const [metrics, setMetrics] = useState<MovieServerHostMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    try {
      const data = await getMovieServerHostMetrics();
      if (!mounted.current) return;
      setMetrics(data);
      setError(null);
      setHistory((prev) => {
        const next: Sample[] = [
          ...prev,
          {
            at: Date.now(),
            cpu: data.cpu.usagePercent,
            mem: data.memory.usedPercent,
          },
        ];
        return next.length > HISTORY_LEN ? next.slice(-HISTORY_LEN) : next;
      });
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Could not load server metrics.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [poll]);

  const cpuHistory = history
    .map((s) => (s.cpu == null ? 0 : s.cpu))
    .filter((_, i) => history[i]?.cpu != null || i === history.length - 1);
  const memHistory = history.map((s) => s.mem);

  return (
    <section className={`${styles.panel} ${styles.panelServer}`}>
      <div className={styles.panelHead}>
        <div className={styles.hostHeadRow}>
          <div className={styles.panelTitleBlock}>
            <span className={`${styles.panelIcon} ${styles.panelIconServer}`} aria-hidden>
              <ZapIcon className={styles.panelIconSvg} />
            </span>
            <div>
              <h2 className={styles.panelTitle}>Server resources</h2>
              <p className={styles.panelHint}>
                Live CPU, RAM, and website storage on the API host — updates every {POLL_MS / 1000}s.
              </p>
            </div>
          </div>
          <span className={styles.liveBadge} title={metrics?.timestamp ?? ""}>
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

        {!metrics && !error ? (
          <p className={styles.empty}>Loading server metrics…</p>
        ) : null}

        {metrics ? (
          <>
            <div className={styles.hostGrid}>
              <div className={`${styles.hostCard} ${styles.hostCardEnter}`}>
                <h3 className={styles.hostCardTitle}>
                  <ZapIcon className={styles.hostCardIcon} aria-hidden />
                  CPU
                </h3>
                <Meter
                  label="Usage"
                  value={metrics.cpu.usagePercent}
                  hint={`${metrics.cpu.cores} cores · load ${metrics.cpu.load1} / ${metrics.cpu.load5} / ${metrics.cpu.load15}`}
                />
                <Sparkline values={cpuHistory} color="#26bfb0" />
              </div>
              <div className={`${styles.hostCard} ${styles.hostCardEnter}`}>
                <h3 className={styles.hostCardTitle}>
                  <GridIcon className={styles.hostCardIcon} aria-hidden />
                  Memory
                </h3>
                <Meter
                  label="Host RAM used"
                  value={metrics.memory.usedPercent}
                  tone="violet"
                  hint={`${metrics.memory.usedMb.toLocaleString()} / ${metrics.memory.totalMb.toLocaleString()} MB · API RSS ${metrics.memory.apiRssMb} MB`}
                />
                <Sparkline values={memHistory} color="#a89bff" />
              </div>
              <div className={`${styles.hostCard} ${styles.hostCardEnter}`}>
                <h3 className={styles.hostCardTitle}>
                  <CloudUploadIcon className={styles.hostCardIcon} aria-hidden />
                  Disk (uploads volume)
                </h3>
                <Meter
                  label="Filesystem used"
                  value={metrics.storage.diskUsedPercent}
                  tone="amber"
                  hint={`${formatGb(metrics.storage.diskUsedGb)} used · ${formatGb(metrics.storage.diskFreeGb)} free of ${formatGb(metrics.storage.diskTotalGb)}`}
                />
                <p className={styles.pathMono} title={metrics.storage.uploadsPath}>
                  {metrics.storage.uploadsPath}
                </p>
              </div>
            </div>

            <div className={styles.storageBlock}>
              <div className={styles.storageSummary}>
                <div>
                  <span className={styles.statLabel}>Website uploads</span>
                  <span className={styles.storageBig}>
                    {formatBytes(metrics.storage.uploadsBytes)}
                  </span>
                </div>
                <div>
                  <span className={styles.statLabel}>Playback temp</span>
                  <span className={styles.storageBig}>
                    {formatBytes(metrics.storage.tempPlaybackBytes)}
                  </span>
                  <span className={styles.meterHint}>HLS cache / transcode scratch</span>
                </div>
              </div>

              {metrics.storage.breakdown.length > 0 ? (
                <ul className={styles.breakdownList}>
                  {metrics.storage.breakdown.map((row) => (
                    <li key={row.name} className={styles.breakdownRow}>
                      <span className={styles.breakdownName}>
                        {row.name}
                        {row.external ? (
                          <span className={styles.breakdownTag}>Samba mount</span>
                        ) : null}
                      </span>
                      <span className={styles.breakdownBytes}>
                        {row.external ? "—" : formatBytes(row.bytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.meterHint}>No folders under uploads yet.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
