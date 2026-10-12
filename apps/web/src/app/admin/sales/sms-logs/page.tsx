"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  ChatIcon,
  CheckIcon,
  PulseIcon,
  TrashIcon,
} from "@/components/admin/icons";
import {
  bulkDeleteAdminSmsLogs,
  bulkUpdateAdminSmsLogsStatus,
  deleteAdminSmsLog,
  listAdminSmsLogs,
  updateAdminSmsLogStatus,
  type SmsLogRow,
} from "@/lib/api";

const FILTER_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "unmatched", label: "Unmatched" },
  { value: "matched", label: "Matched" },
  { value: "ignored", label: "Ignored" },
];

const SMS_LOG_STATUS_OPTIONS = [
  { value: "unmatched", label: "Unmatched" },
  { value: "matched", label: "Matched" },
  { value: "ignored", label: "Ignored" },
];

type SmsLogStatTone = "brand" | "success" | "amber" | "muted";

type SmsLogOverviewItem = {
  key: string;
  tone: SmsLogStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function SmsLogOverviewStats({ items }: { items: SmsLogOverviewItem[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-sms-logs-overview"
      aria-label="SMS log overview"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone}`}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {item.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {item.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {item.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function AdminSmsLogsPage() {
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<SmsLogRow["status"]>("ignored");
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await listAdminSmsLogs(status || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status]);

  const stats = useMemo(() => {
    let matched = 0;
    let unmatched = 0;
    let ignored = 0;
    for (const row of logs) {
      if (row.status === "matched") matched += 1;
      else if (row.status === "unmatched") unmatched += 1;
      else if (row.status === "ignored") ignored += 1;
    }
    return { total: logs.length, matched, unmatched, ignored };
  }, [logs]);

  const overviewItems = useMemo((): SmsLogOverviewItem[] => {
    return [
      {
        key: "shown",
        tone: "brand",
        icon: <ChatIcon className="h-4 w-4" aria-hidden />,
        label: "Shown",
        value: stats.total.toLocaleString(),
        meta: status
          ? `Filtered by ${status}`
          : "Current filter results",
      },
      {
        key: "matched",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" aria-hidden />,
        label: "Matched",
        value: stats.matched.toLocaleString(),
        meta: "Linked to orders",
      },
      {
        key: "unmatched",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" aria-hidden />,
        label: "Unmatched",
        value: stats.unmatched.toLocaleString(),
        meta: "Awaiting review",
      },
      {
        key: "ignored",
        tone: "muted",
        icon: <TrashIcon className="h-4 w-4" aria-hidden />,
        label: "Ignored",
        value: stats.ignored.toLocaleString(),
        meta: "Marked as ignored",
      },
    ];
  }, [stats, status]);

  const allSelected =
    logs.length > 0 && logs.every((row) => selectedIds.has(row._id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(logs.map((row) => row._id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const trxIds = [
      ...new Set(
        logs
          .filter((row) => selectedIds.has(row._id) && row.trxId?.trim())
          .map((row) => row.trxId!.trim()),
      ),
    ];
    if (
      !window.confirm(
        `Delete ${ids.length} selected SMS log${ids.length === 1 ? "" : "s"}? Duplicate TrxIDs will be removed together. This cannot be undone.`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    setError(null);
    try {
      const result = await bulkDeleteAdminSmsLogs(ids, trxIds);
      if (result.deleted === 0) {
        setError("No SMS logs were deleted");
        return;
      }
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk delete failed";
      if (message.includes("Cannot POST") || message.includes("404")) {
        setError(
          "Delete API not deployed on server. Run: sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-api.sh",
        );
      } else {
        setError(message);
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDelete(row: SmsLogRow) {
    const label = row.trxId ? `TrxID ${row.trxId}` : row.sender ?? "this entry";
    const dupNote = row.trxId
      ? " All entries with this TrxID will be removed."
      : "";
    if (
      !window.confirm(
        `Delete SMS log (${label})?${dupNote} This cannot be undone.`,
      )
    ) {
      return;
    }

    if (!row._id?.trim()) {
      setError("Invalid SMS log id — refresh the page and try again.");
      return;
    }

    setDeletingId(row._id);
    setError(null);
    try {
      const result = await deleteAdminSmsLog(
        row._id,
        row.trxId?.trim() || undefined,
      );
      if (result.deleted === 0) {
        setError("SMS log could not be deleted — it may already be removed.");
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(row._id);
        return next;
      });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      if (message.includes("Cannot POST") || message.includes("404")) {
        setError(
          "Delete API not deployed on server. Run: sudo /opt/uniqbd.com/deploy/deploy/ubuntu22.04/rebuild-api.sh",
        );
      } else {
        setError(message);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleStatusChange(row: SmsLogRow, nextStatus: SmsLogRow["status"]) {
    if (nextStatus === row.status) return;

    setUpdatingId(row._id);
    setError(null);
    try {
      await updateAdminSmsLogStatus(row._id, nextStatus);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleBulkStatusChange() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Change status to “${bulkStatus}” for ${ids.length} selected log${ids.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }

    setBulkStatusUpdating(true);
    setError(null);
    try {
      await bulkUpdateAdminSmsLogsStatus(ids, bulkStatus);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk status update failed");
    } finally {
      setBulkStatusUpdating(false);
    }
  }

  const rowBusy =
    bulkDeleting || bulkStatusUpdating || deletingId !== null || updatingId !== null;

  return (
    <AdminPageLayout
      section="Sales"
      title="SMS logs"
      description="Incoming payment SMS from the Android forwarding app."
      icon={ChatIcon}
      action={
        <Link
          href="/admin/settings/payments?tab=mfs"
          className="dashboard-pro-btn-ghost"
        >
          MFS gateways
        </Link>
      }
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <AdminOrderListCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="SMS log entries"
        subtitle={
          loading
            ? "Loading SMS logs…"
            : `${stats.total} log${stats.total === 1 ? "" : "s"} shown`
        }
        className="admin-sms-logs-list"
      >
        <SmsLogOverviewStats items={overviewItems} />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="admin-sms-logs-filters max-w-xs">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle">
              Filter by status
            </label>
            <AdminSelect
              value={status}
              onChange={setStatus}
              options={FILTER_STATUS_OPTIONS}
            />
          </div>

          {logs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={loading || rowBusy}
                className="dashboard-pro-btn-ghost text-xs disabled:opacity-40"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-strong/40 px-2 py-1">
                <AdminSelect
                  value={bulkStatus}
                  onChange={(value) =>
                    setBulkStatus(value as SmsLogRow["status"])
                  }
                  options={SMS_LOG_STATUS_OPTIONS}
                  disabled={loading || rowBusy || selectedIds.size === 0}
                  className="min-w-[8.5rem]"
                />
                <button
                  type="button"
                  disabled={
                    selectedIds.size === 0 || loading || rowBusy
                  }
                  onClick={() => void handleBulkStatusChange()}
                  className="dashboard-pro-btn-ghost text-xs disabled:opacity-40"
                >
                  {bulkStatusUpdating ? "Updating…" : "Apply status"}
                </button>
              </div>
              <button
                type="button"
                disabled={
                  selectedIds.size === 0 ||
                  bulkDeleting ||
                  loading ||
                  rowBusy
                }
                onClick={() => void handleBulkDelete()}
                className="dashboard-pro-btn-ghost inline-flex items-center gap-1.5 text-xs text-rose-300 disabled:opacity-40"
              >
                <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                {bulkDeleting
                  ? "Deleting…"
                  : `Delete selected (${selectedIds.size})`}
              </button>
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="panel-3d-table-wrap overflow-x-auto">
          {loading ? (
            <div className="panel-3d-empty px-6 py-12">
              <p className="text-sm text-subtle">Loading…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="panel-3d-empty px-6 py-12">
              <p className="text-sm text-subtle">
                No SMS logs yet. Legacy Android app endpoints:{" "}
                <code className="text-xs">POST /api/app/login</code> and{" "}
                <code className="text-xs">POST /api/app/sms/store</code> (Bearer
                token).
              </p>
            </div>
          ) : (
            <table className="panel-3d-table w-full text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={bulkDeleting || rowBusy}
                      aria-label="Select all SMS logs"
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <th>Time</th>
                  <th>Sender</th>
                  <th>TrxID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th className="w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row._id)}
                        onChange={() => toggleSelect(row._id)}
                        disabled={rowBusy}
                        aria-label={`Select SMS log ${row.trxId ?? row._id}`}
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                    <td className="whitespace-nowrap text-xs text-subtle">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="text-xs">{row.sender ?? "—"}</td>
                    <td className="font-mono text-xs">{row.trxId ?? "—"}</td>
                    <td className="text-xs">
                      {row.amount !== undefined ? `৳${row.amount}` : "—"}
                    </td>
                    <td className="min-w-[9rem]">
                      <AdminSelect
                        value={row.status}
                        onChange={(value) =>
                          void handleStatusChange(
                            row,
                            value as SmsLogRow["status"],
                          )
                        }
                        options={SMS_LOG_STATUS_OPTIONS}
                        disabled={rowBusy || updatingId === row._id}
                        className="text-xs"
                      />
                    </td>
                    <td className="max-w-xs truncate text-xs text-subtle">
                      {row.body}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        disabled={
                          rowBusy ||
                          deletingId === row._id ||
                          updatingId === row._id
                        }
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-40"
                        aria-label="Delete SMS log"
                      >
                        <TrashIcon
                          className={`h-4 w-4 ${deletingId === row._id ? "opacity-50" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminOrderListCard>
    </AdminPageLayout>
  );
}
