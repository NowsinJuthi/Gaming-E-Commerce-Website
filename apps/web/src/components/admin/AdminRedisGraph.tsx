"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PulseIcon } from "@/components/admin/icons";
import { getSystemStatus, type RedisMetrics, type SystemStatus } from "@/lib/api";

const CHART_H = 120;
const CHART_W = 480;
const HISTORY_LEN = 24;
const POLL_MS = 5000;

type Sample = {
  at: number;
  latencyMs: number;
  memoryMb: number;
  opsPerSec: number;
};

function lastN<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return items.slice(-n);
}

function maxVal(values: number[], floor = 1): number {
  return Math.max(...values, floor);
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function RedisAreaChart({
  values,
  labels,
  color,
}: {
  values: number[];
  labels: string[];
  color: string;
}) {
  const gradientId = useId();
  const peak = maxVal(values);
  const step = CHART_W / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = CHART_H - 18 - (v / peak) * (CHART_H - 36);
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const area = `${points[0]?.split(",")[0] ?? 0},${CHART_H - 18} ${line} ${CHART_W},${CHART_H - 18}`;

  return (
    <div className="admin-redis-chart-wrap">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="admin-redis-chart-svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={0}
            y1={CHART_H - 18 - frac * (CHART_H - 36)}
            x2={CHART_W}
            y2={CHART_H - 18 - frac * (CHART_H - 36)}
            className="admin-redis-chart-gridline"
          />
        ))}
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="admin-redis-chart-labels">
        {labels.map((label, index) => (
          <span key={`${index}-${label}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div className={`admin-redis-metric${tone !== "default" ? ` admin-redis-metric--${tone}` : ""}`}>
      <span className="admin-redis-metric-label">{label}</span>
      <span className="admin-redis-metric-value">{value}</span>
    </div>
  );
}

function redisStatusStyles(tone: "checking" | "connected" | "offline" | "paused") {
  if (tone === "connected") {
    return {
      iconBox:
        "border-emerald-400/60 bg-gradient-to-br from-emerald-400/35 via-emerald-500/20 to-emerald-950/30 text-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.45)]",
      badge:
        "border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]",
      dot: "bg-emerald-400 shadow-[0_0_10px_#34d399]",
      pulseIcon: "#6ee7b7",
    };
  }
  if (tone === "offline") {
    return {
      iconBox:
        "border-rose-400/60 bg-gradient-to-br from-rose-500/35 via-rose-500/18 to-rose-950/30 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.4)]",
      badge:
        "border-rose-400/60 bg-rose-500/20 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.35)]",
      dot: "bg-rose-500 shadow-[0_0_10px_#f43f5e]",
      pulseIcon: "#fca5a5",
    };
  }
  if (tone === "paused") {
    return {
      iconBox:
        "border-border/60 bg-muted/20 text-foreground-muted shadow-none",
      badge: "border-border/60 bg-muted/30 text-foreground-muted",
      dot: "bg-foreground-muted/60",
      pulseIcon: "rgb(var(--fg-muted))",
    };
  }
  return {
    iconBox:
      "border-emerald-400/40 bg-emerald-500/12 text-emerald-400/85 shadow-[0_0_14px_rgba(52,211,153,0.2)]",
    badge: "border-emerald-400/40 bg-emerald-500/12 text-emerald-400/85",
    dot: "bg-emerald-400/70",
    pulseIcon: "#34d399",
  };
}

export function AdminRedisGraph({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const [redis, setRedis] = useState<SystemStatus["redis"] | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const poll = useCallback(async () => {
    if (!active) return;
    if (document.visibilityState === "hidden" && hasLoadedRef.current) return;

    try {
      const status = await getSystemStatus();
      const nextRedis = status.redis;
      setRedis(nextRedis);
      setError(null);

      const metrics = nextRedis.metrics;
      if (metrics) {
        setHistory((current) =>
          lastN(
            [
              ...current,
              {
                at: Date.now(),
                latencyMs: nextRedis.latencyMs ?? 0,
                memoryMb: metrics.usedMemoryMb,
                opsPerSec: metrics.opsPerSec,
              },
            ],
            HISTORY_LEN,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Redis stats");
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }

    setLoading((current) => (hasLoadedRef.current ? current : true));
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, poll]);

  const metrics: RedisMetrics | undefined = redis?.metrics;
  const memorySeries = useMemo(
    () => history.map((s) => s.memoryMb),
    [history],
  );
  const latencySeries = useMemo(
    () => history.map((s) => s.latencyMs),
    [history],
  );
  const opsSeries = useMemo(
    () => history.map((s) => s.opsPerSec),
    [history],
  );
  const timeLabels = useMemo(() => {
    const firstSample = history[0];
    if (!firstSample) return ["—"];
    const fmt = (t: number) =>
      new Date(t).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    if (history.length === 1) return [fmt(firstSample.at)];
    const lastSample = history.at(-1) ?? firstSample;
    const first = fmt(firstSample.at);
    const last = fmt(lastSample.at);
    if (history.length === 2) {
      return first === last ? [first] : [first, last];
    }
    const middleSample = history[Math.floor(history.length / 2)] ?? firstSample;
    const mid = fmt(middleSample.at);
    if (first === mid && mid === last) return [first];
    if (first === mid) return [first, last];
    if (mid === last) return [first, mid];
    return [first, mid, last];
  }, [history]);

  const isPaused = !active;
  const isChecking = active && loading && !redis;
  const isOnline = active && !isChecking && Boolean(redis?.ok) && !error;
  const statusTone: "checking" | "connected" | "offline" | "paused" = isPaused
    ? "paused"
    : isChecking
      ? "checking"
      : isOnline
        ? "connected"
        : "offline";
  const statusLabel = isPaused
    ? "Paused"
    : isChecking
      ? "Checking…"
      : isOnline
        ? "Connected"
        : "Offline";
  const statusVisual = redisStatusStyles(statusTone);

  return (
    <section
      className={`admin-redis-panel shell-panel${compact ? " admin-redis-panel--sidebar" : ""}`}
    >
      <div className="admin-redis-panel-head">
        <div className="admin-redis-panel-title-wrap">
          <span
            className={`admin-redis-panel-icon relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${statusVisual.iconBox}`}
            aria-hidden
          >
            <PulseIcon className="h-4 w-4" style={{ color: statusVisual.pulseIcon }} />
            <span
              className={`absolute -right-0.5 -top-0.5 block h-2.5 w-2.5 rounded-full ${statusVisual.dot}`}
              aria-hidden
            />
          </span>
          <div>
            <h2 className="admin-redis-panel-title">Redis server</h2>
            <p className="admin-redis-panel-sub">
              Live memory, latency, and throughput · updates every 5s
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusVisual.badge}`}
          role="status"
        >
          <span
            className={`block h-2 w-2 shrink-0 rounded-full ${statusVisual.dot}`}
            aria-hidden
          />
          {statusLabel}
        </span>
      </div>

      {error ? (
        <p className="admin-redis-error">{error}</p>
      ) : isPaused && !redis ? (
        <p className="admin-redis-loading text-foreground-muted">
          Live polling is paused. Open the API Status tab to refresh Redis metrics.
        </p>
      ) : isChecking ? (
        <p className="admin-redis-loading">Loading Redis metrics…</p>
      ) : (
        <>
          <div className="admin-redis-metrics">
            <MetricPill
              label="Memory"
              value={metrics ? `${metrics.usedMemoryMb} MB` : "—"}
              tone={isOnline ? "ok" : "warn"}
            />
            <MetricPill
              label="Latency"
              value={redis?.latencyMs != null ? `${redis.latencyMs} ms` : "—"}
            />
            <MetricPill
              label="Ops/sec"
              value={metrics ? String(metrics.opsPerSec) : "—"}
            />
            <MetricPill
              label="Clients"
              value={metrics ? String(metrics.connectedClients) : "—"}
            />
            <MetricPill
              label="Keys"
              value={metrics ? String(metrics.totalKeys) : "—"}
            />
            <MetricPill
              label="Hit rate"
              value={
                metrics?.hitRate != null ? `${metrics.hitRate}%` : "—"
              }
            />
            <MetricPill
              label="Version"
              value={metrics?.version ?? "—"}
            />
            <MetricPill
              label="Uptime"
              value={formatUptime(metrics?.uptimeSeconds)}
            />
          </div>

          <div className="admin-redis-charts">
            <article className="admin-redis-chart-card">
              <header className="admin-redis-chart-head">
                <h3>Memory usage</h3>
                <span>
                  {metrics
                    ? `${metrics.usedMemoryMb} MB${
                        metrics.peakMemoryMb
                          ? ` · peak ${metrics.peakMemoryMb} MB`
                          : ""
                      }`
                    : "—"}
                </span>
              </header>
              <RedisAreaChart
                values={
                  memorySeries.length > 1
                    ? memorySeries
                    : [metrics?.usedMemoryMb ?? 0, metrics?.usedMemoryMb ?? 0]
                }
                labels={timeLabels}
                color="rgb(244 63 94)"
              />
            </article>

            <article className="admin-redis-chart-card">
              <header className="admin-redis-chart-head">
                <h3>Response latency</h3>
                <span>
                  {redis?.state ? `state: ${redis.state}` : "ping round-trip"}
                </span>
              </header>
              <RedisAreaChart
                values={
                  latencySeries.length > 1
                    ? latencySeries
                    : [redis?.latencyMs ?? 0, redis?.latencyMs ?? 0]
                }
                labels={timeLabels}
                color="rgb(56 189 248)"
              />
            </article>

            <article className="admin-redis-chart-card">
              <header className="admin-redis-chart-head">
                <h3>Throughput</h3>
                <span>
                  {metrics
                    ? `${metrics.opsPerSec} ops/sec · ${metrics.connectedClients} clients`
                    : "operations per second"}
                </span>
              </header>
              <RedisAreaChart
                values={
                  opsSeries.length > 1
                    ? opsSeries
                    : [metrics?.opsPerSec ?? 0, metrics?.opsPerSec ?? 0]
                }
                labels={timeLabels}
                color="rgb(52 211 153)"
              />
            </article>
          </div>
        </>
      )}
    </section>
  );
}
