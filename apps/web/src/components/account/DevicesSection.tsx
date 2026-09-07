"use client";

import { useEffect, useState } from "react";
import {
  getDevices,
  revokeAllDevices,
  revokeDevice,
  type Device,
} from "@/lib/api";
import {
  accountInsetPanelClass,
  accountPanelClass,
  accountSectionStackClass,
  type AccountSectionProps,
} from "@/components/account/account-section-layout";

function formatExpiresAt(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export function DevicesSection({ embedded = false }: AccountSectionProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDevices()
      .then((list) => {
        if (!cancelled) setDevices(list);
      })
      .catch(() => {
        if (!cancelled) {
          setDevices([]);
          setMsg({ text: "Could not load devices.", ok: false });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRevoke(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      await revokeDevice(id);
      setDevices((cur) => cur.filter((d) => d.id !== id));
      setMsg({ text: "Device session revoked.", ok: true });
    } catch {
      setMsg({ text: "Could not revoke device.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function onRevokeAll() {
    setBusy("all");
    setMsg(null);
    try {
      await revokeAllDevices();
      setDevices([]);
      setMsg({
        text: "All sessions revoked. You may need to log in again.",
        ok: true,
      });
    } catch {
      setMsg({ text: "Could not revoke sessions.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div
        className={accountPanelClass(
          embedded,
          "p-10 text-center text-sm text-foreground-muted",
        )}
      >
        Loading devices…
      </div>
    );
  }

  const deviceItemClass = accountInsetPanelClass(
    embedded,
    "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
  );

  return (
    <div className={accountSectionStackClass(embedded)}>
      <div
        className={accountPanelClass(
          embedded,
          "flex flex-wrap items-center justify-between gap-3",
        )}
      >
        <p className="text-sm text-foreground-muted">
          {devices.length} active session{devices.length !== 1 ? "s" : ""}
        </p>
        {devices.length > 0 && (
          <button
            type="button"
            onClick={onRevokeAll}
            disabled={busy !== null}
            className="dashboard-pro-btn-ghost !text-red-500 hover:!text-red-400 disabled:opacity-50"
          >
            {busy === "all" ? "Revoking…" : "Revoke all"}
          </button>
        )}
      </div>

      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.ok
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      {devices.length === 0 ? (
        <div
          className={accountPanelClass(
            embedded,
            "border-dashed p-10 text-center text-sm text-foreground-muted",
          )}
        >
          No active sessions.
        </div>
      ) : (
        <ul className="grid w-full gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <li key={d.id} className={deviceItemClass}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {d.userAgent ?? "Unknown device"}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  IP: {d.ip ?? "—"}
                  {d.createdAt
                    ? ` · Signed in ${new Date(d.createdAt).toLocaleString()}`
                    : ""}
                </p>
                <p className="text-xs text-subtle">
                  Expires {formatExpiresAt(d.expiresAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(d.id)}
                disabled={busy !== null}
                className="dashboard-pro-btn-ghost shrink-0 px-3 py-1.5 !text-red-500 hover:!text-red-400 disabled:opacity-50"
              >
                {busy === d.id ? "…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
