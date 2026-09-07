"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminEmailLogCard } from "@/components/admin/AdminEmailLogCard";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  GridIcon,
  MailIcon,
  PulseIcon,
  TrashIcon,
} from "@/components/admin/icons";
import {
  adminBulkDeleteNotificationDeliveries,
  adminDeleteNotificationDelivery,
  adminListNotificationDeliveries,
  type NotificationDelivery,
} from "@/lib/api";

const LOGS_PER_PAGE = 20;

type EmailLogPeriod = "daily" | "weekly" | "monthly";

const PERIOD_TABS: Array<{ id: EmailLogPeriod; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "pending", label: "Pending" },
];

const PERIOD_DAYS: Record<EmailLogPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

function getPeriodRange(period: EmailLogPeriod): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - PERIOD_DAYS[period]);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatRangeLabel(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function AdminEmailLogsPage() {
  const [period, setPeriod] = useState<EmailLogPeriod>("weekly");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<NotificationDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getPeriodRange(period), [period]);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const searchActive = search.length > 0;
  const totalPages = Math.max(1, Math.ceil(total / LOGS_PER_PAGE));
  const pageStart = total === 0 ? 0 : (page - 1) * LOGS_PER_PAGE + 1;
  const pageEnd = Math.min(page * LOGS_PER_PAGE, total);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListNotificationDeliveries({
        channel: "email",
        status: status || undefined,
        search: search || undefined,
        from: search ? undefined : range.from,
        to: search ? undefined : range.to,
        page,
        limit: LOGS_PER_PAGE,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [status, search, range.from, range.to, page]);

  useEffect(() => {
    setPage(1);
  }, [period, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, status, search, period]);

  const allPageSelected =
    logs.length > 0 && logs.every((row) => selectedIds.has(row._id));

  function toggleSelectAll() {
    if (allPageSelected) {
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

  const handleDelete = async (row: NotificationDelivery) => {
    const label = row.orderNumber
      ? `order ${row.orderNumber}`
      : row.title || row.event;
    if (
      !window.confirm(
        `Delete this email log (${label})? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(row._id);
    setError(null);
    try {
      await adminDeleteNotificationDelivery(row._id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} selected email log${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    setError(null);
    try {
      await adminBulkDeleteNotificationDeliveries(ids);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const pageStats = useMemo(() => {
    let sent = 0;
    let failed = 0;
    for (const row of logs) {
      if (row.status === "sent") sent += 1;
      else if (row.status === "failed") failed += 1;
    }
    return { sent, failed };
  }, [logs]);

  const subtitle = loading
    ? "Loading email logs…"
    : searchActive
      ? `${total.toLocaleString()} result${total === 1 ? "" : "s"} for “${search}”`
      : `${total.toLocaleString()} log${total === 1 ? "" : "s"} · ${rangeLabel}`;

  return (
    <AdminPageLayout
      section="Sales"
      title="Email logs"
      description="Outbound email delivery attempts from the notification pipeline."
      icon={MailIcon}
      action={
        <Link href="/admin/settings/email" className="dashboard-pro-btn-ghost">
          Email / SMTP
        </Link>
      }
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="customer-dashboard-page dashboard-page--pro min-w-0 space-y-4">
        <section
          className="customer-dashboard-overview-section"
          aria-label="Email log overview"
        >
          <dl className="customer-dashboard-overview-stats">
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--brand">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <MailIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Total</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : total.toLocaleString()}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {searchActive
                    ? "Matching search"
                    : `${PERIOD_TABS.find((t) => t.id === period)?.label ?? period} · ${rangeLabel}`}
                </p>
              </div>
            </div>
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--success">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <CheckIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Sent</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : pageStats.sent.toLocaleString()}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  On this page
                </p>
              </div>
            </div>
            <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--amber">
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                <PulseIcon className="h-4 w-4" />
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">Failed</dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {loading ? "…" : pageStats.failed.toLocaleString()}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  On this page
                </p>
              </div>
            </div>
          </dl>
        </section>

        <section
          className="customer-dashboard-recent-orders-section"
          aria-labelledby="admin-email-logs-title"
        >
          <header
            className="customer-dashboard-recent-orders-head-card customer-dashboard-mobile-header-card mb-2 max-lg:mb-1.5"
          >
            <div
              className="customer-dashboard-mobile-header-glow"
              aria-hidden
            />
            <div className="customer-dashboard-mobile-header-main">
              <div className="customer-dashboard-mobile-header-welcome-row">
                <span
                  className="customer-dashboard-mobile-header-avatar"
                  aria-hidden
                >
                  <MailIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    id="admin-email-logs-title"
                    className="customer-dashboard-mobile-page-title"
                  >
                    Email log entries
                  </h2>
                  <p className="customer-dashboard-mobile-welcome-sub">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="admin-email-logs-toolbar mb-4 space-y-4 px-1">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-3 sm:px-4">
              <div
                className="admin-email-logs-search-row flex min-w-0 w-full flex-row flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto sm:gap-2"
              >
                <label htmlFor="admin-email-logs-search" className="sr-only">
                  Search logs
                </label>
                <input
                  id="admin-email-logs-search"
                  type="search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setPage(1);
                      setSearch(searchDraft.trim());
                    }
                  }}
                  placeholder="Order number, email, or mobile"
                  className="admin-input admin-email-logs-search-input min-w-0 flex-1 max-sm:min-w-[3.25rem] sm:flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSearch(searchDraft.trim());
                  }}
                  className="panel-3d-btn admin-email-logs-search-btn shrink-0 text-xs"
                >
                  Search
                </button>
                {searchActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSearch("");
                      setSearchDraft("");
                    }}
                    className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-sm max-sm:hidden sm:px-4"
                  >
                    Clear
                  </button>
                ) : null}

                <div
                  className="hidden shrink-0 self-stretch w-px bg-border/50 sm:block"
                  aria-hidden
                />

                <label htmlFor="admin-email-logs-status" className="sr-only">
                  Filter by status
                </label>
                <div className="min-w-0 flex-1 max-sm:min-w-[4.5rem] sm:min-w-[10rem] sm:flex-none">
                  <AdminSelect
                    id="admin-email-logs-status"
                    value={status}
                    onChange={(value) => {
                      setPage(1);
                      setStatus(value);
                    }}
                    className="admin-email-logs-status-select w-full min-w-0"
                    options={STATUS_OPTIONS}
                  />
                </div>
              </div>
            </div>

            <div className="admin-email-logs-period-row flex flex-wrap items-end justify-between gap-3">
              {!searchActive ? (
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    Log period
                  </p>
                  <div
                    className="admin-notifications-tabs"
                    role="tablist"
                    aria-label="Email log period"
                  >
                    {PERIOD_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={period === tab.id}
                        onClick={() => {
                          setPage(1);
                          setPeriod(tab.id);
                        }}
                        className={`admin-notifications-tab${
                          period === tab.id
                            ? " admin-notifications-tab--active"
                            : ""
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {logs.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={loading || bulkDeleting || deletingId !== null}
                    className="dashboard-pro-btn-ghost text-xs disabled:opacity-40"
                  >
                    {allPageSelected ? "Deselect all" : "Select all on page"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      selectedIds.size === 0 ||
                      bulkDeleting ||
                      loading ||
                      deletingId !== null
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
          </div>

          {loading ? (
            <div className="dashboard-pro-empty py-10">
              <p className="text-sm text-subtle">Loading email logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="dashboard-pro-empty py-10">
              <span className="dashboard-pro-empty-icon" aria-hidden>
                <GridIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-foreground">
                {searchActive
                  ? "No matching email logs"
                  : "No email logs in this period"}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {searchActive
                  ? "Try another order number, email, or mobile."
                  : "Configure SMTP to start sending and logging outbound email."}
              </p>
              {!searchActive ? (
                <Link
                  href="/admin/settings/email"
                  className="dashboard-pro-btn mt-4"
                >
                  Email / SMTP settings
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="customer-orders-list">
              {logs.map((row) => (
                <AdminEmailLogCard
                  key={row._id}
                  row={row}
                  selected={selectedIds.has(row._id)}
                  onToggleSelect={() => toggleSelect(row._id)}
                  onDelete={() => void handleDelete(row)}
                  disabled={loading || bulkDeleting}
                  deleting={deletingId === row._id}
                />
              ))}
            </div>
          )}

          {!loading && total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 pt-4">
              <p className="text-xs text-foreground-muted">
                Showing {pageStart}–{pageEnd} of {total.toLocaleString()} log
                {total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-foreground-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AdminPageLayout>
  );
}
