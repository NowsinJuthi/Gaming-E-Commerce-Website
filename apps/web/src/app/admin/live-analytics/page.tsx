"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { PulseIcon } from "@/components/admin/icons";
import {
  getLiveAnalyticsSnapshot,
  parseLiveSnapshot,
  type LiveAnalyticsSnapshot,
} from "@/lib/live-analytics-api";
import { getLiveAnalyticsSocket } from "@/lib/live-analytics-socket";

function formatWhen(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LiveAnalyticsAdminPage() {
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
    };
    socket.on("live:snapshot", onSnapshot);
    if (socket.connected) {
      socket.connect();
    }
    return () => {
      socket.off("live:snapshot", onSnapshot);
    };
  }, []);

  const visitors = snapshot?.visitors ?? [];
  const mediaSessions = snapshot?.mediaSessions ?? [];

  return (
    <AdminPageLayout
      section="Administration"
      title="Live visitors & media"
      description="Real-time site visitors and who is watching movies or series right now."
      icon={PulseIcon}
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
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Active visitors
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand">
            {loading && !snapshot ? "—" : snapshot?.visitorCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Updated {snapshot ? formatWhen(snapshot.updatedAt) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Watching now
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-500">
            {loading && !snapshot ? "—" : mediaSessions.length}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">Movies & series players</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Now watching</h2>
        {mediaSessions.length === 0 ? (
          <p className="rounded-lg border border-border bg-elevated px-4 py-6 text-sm text-foreground-muted">
            No active playback sessions.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Episode</th>
                  <th className="px-4 py-2.5 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {mediaSessions.map((row) => (
                  <tr key={row.visitorKey} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-2.5">{row.label}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/media/watch/${row.titleId}`}
                        className="font-medium text-brand hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.titleName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground-muted">
                      {row.episodeName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-foreground-muted">
                      {formatWhen(row.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Active pages</h2>
        {visitors.length === 0 ? (
          <p className="rounded-lg border border-border bg-elevated px-4 py-6 text-sm text-foreground-muted">
            No active visitors in the last ~90 seconds.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Visitor</th>
                  <th className="px-4 py-2.5 font-semibold">Page</th>
                  <th className="px-4 py-2.5 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((row) => (
                  <tr key={row.visitorKey} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-2.5">{row.label}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground-muted">
                      {row.path}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-foreground-muted">
                      {formatWhen(row.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageLayout>
  );
}
