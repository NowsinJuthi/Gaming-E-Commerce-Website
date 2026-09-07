"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  AdminOrderStatField,
  AdminOrderStatsGrid,
  AdminOrderTwoColumnLayout,
  SUPPORT_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CheckIcon, ReceiptIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  assignTicket,
  getTicket,
  getTicketMessages,
  getTicketOverview,
  listStaff,
  listTickets,
  replyTicket,
  updateTicketStatus,
  type StaffMember,
  type Ticket,
  type TicketMessage,
  type TicketOverview,
  type TicketStatus,
} from "@/lib/api";

const STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
];

const STATUS_STYLE: Record<string, string> = {
  open: "dashboard-pro-status dashboard-pro-status--amber",
  in_progress: "dashboard-pro-status dashboard-pro-status--brand",
  pending: "dashboard-pro-status",
  resolved: "dashboard-pro-status dashboard-pro-status--green",
  closed: "dashboard-pro-status",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "text-foreground-muted",
  medium: "text-sky-300",
  high: "text-amber-300",
  urgent: "text-rose-300",
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function clickableStatClass(active: boolean) {
  return `admin-products-stat-field w-full text-left transition${
    active ? " ring-1 ring-brand/50 bg-brand/5" : ""
  }`;
}

function statusLabel(status: TicketStatus | "") {
  return status ? status.replace("_", " ") : "All statuses";
}

function overviewKeyForStatus(
  status: TicketStatus,
): "open" | "inProgress" | "pending" | "resolved" | "closed" {
  switch (status) {
    case "open":
      return "open";
    case "in_progress":
      return "inProgress";
    case "pending":
      return "pending";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
  }
}

function patchOverviewStatus(
  current: TicketOverview,
  from: TicketStatus,
  to: TicketStatus,
): TicketOverview {
  if (from === to) return current;
  const next = { ...current };
  const fromKey = overviewKeyForStatus(from);
  const toKey = overviewKeyForStatus(to);
  next[fromKey] = Math.max(0, next[fromKey] - 1);
  next[toKey] += 1;
  return next;
}

function patchOverviewAssign(
  current: TicketOverview,
  wasUnassigned: boolean,
  isUnassigned: boolean,
): TicketOverview {
  if (wasUnassigned === isUnassigned) return current;
  if (wasUnassigned && !isUnassigned) {
    return {
      ...current,
      unassigned: Math.max(0, current.unassigned - 1),
    };
  }
  return { ...current, unassigned: current.unassigned + 1 };
}

function mergeTicketAfterAction(
  current: Ticket[],
  updated: Ticket,
  statusFilter: TicketStatus | "",
): Ticket[] {
  if (statusFilter && updated.status !== statusFilter) {
    return current.filter((row) => row._id !== updated._id);
  }
  return current.map((row) => (row._id === updated._id ? updated : row));
}

function syncDetailCache(
  cache: Map<string, { ticket: Ticket; messages: TicketMessage[] }>,
  ticket: Ticket,
  messageItems: TicketMessage[],
) {
  cache.set(ticket._id, { ticket, messages: messageItems });
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [overview, setOverview] = useState<TicketOverview | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
    const ticketsCacheKeyRef = useRef("");
  const detailCacheRef = useRef<
    Map<string, { ticket: Ticket; messages: TicketMessage[] }>
  >(new Map());
  const listSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTicketOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    listStaff()
      .then((items) => {
        if (!cancelled) setStaff(items);
      })
      .catch(() => {
        if (!cancelled) setStaff([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cacheKey = `${status || "all"}:${assignedToMe ? "mine" : "all"}`;
    if (ticketsCacheKeyRef.current === cacheKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listTickets({
      status: status || undefined,
      assignedToMe: assignedToMe || undefined,
      limit: 50,
    })
      .then((result) => {
        if (!cancelled) {
          setTickets(result.items);
          ticketsCacheKeyRef.current = cacheKey;
        }
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, assignedToMe, reloadToken]);

  useEffect(() => {
    return () => {
      if (listSyncTimerRef.current) {
        clearTimeout(listSyncTimerRef.current);
      }
    };
  }, []);

  const reloadTickets = useCallback(() => {
    ticketsCacheKeyRef.current = "";
    setReloadToken((value) => value + 1);
  }, []);

  const scheduleListSync = useCallback(() => {
    if (listSyncTimerRef.current) {
      clearTimeout(listSyncTimerRef.current);
    }
    listSyncTimerRef.current = setTimeout(() => {
      reloadTickets();
    }, 700);
  }, [reloadTickets]);

  const staffById = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const member of staff) {
      map.set(member.id, member);
    }
    return map;
  }, [staff]);

  function toggleStatusFilter(next: TicketStatus) {
    setStatus((current) => (current === next ? "" : next));
  }

  function clearFilters() {
    setStatus("");
    setAssignedToMe(false);
  }

  function closePanel() {
    if (busy) return;
    setSelected(null);
    setMessages([]);
    setReply("");
    setInternal(false);
  }

  async function openDetail(id: string) {
    if (busy) return;
    if (selected?._id === id) return;

    const cached = detailCacheRef.current.get(id);
    if (cached) {
      setSelected(cached.ticket);
      setMessages(cached.messages);
      setReply("");
      setInternal(false);
      hideAdminToast();
      return;
    }

    setBusy(true);
    hideAdminToast();
    try {
      const [ticket, messagePage] = await Promise.all([
        getTicket(id),
        getTicketMessages(id, 1, 200),
      ]);
      syncDetailCache(detailCacheRef.current, ticket, messagePage.items);
      setSelected(ticket);
      setMessages(messagePage.items);
      setReply("");
      setInternal(false);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Failed to load ticket.", false);
    } finally {
      setBusy(false);
    }
  }

  async function refreshDetailMessages(ticketId: string) {
    const messagePage = await getTicketMessages(ticketId, 1, 200);
    setMessages(messagePage.items);
    setSelected((current) => {
      if (!current || current._id !== ticketId) return current;
      syncDetailCache(detailCacheRef.current, current, messagePage.items);
      return current;
    });
  }

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    const ticketId = selected._id;
    const body = reply.trim();
    setBusy(true);
    hideAdminToast();
    try {
      const message = await replyTicket(ticketId, body, internal);
      const nextMessages = [...messages, message];
      setMessages(nextMessages);
      setSelected((current) => {
        if (!current || current._id !== ticketId) return current;
        const nextTicket = {
          ...current,
          lastReplyAt: message.createdAt ?? current.lastReplyAt,
        };
        syncDetailCache(detailCacheRef.current, nextTicket, nextMessages);
        return nextTicket;
      });
      setTickets((current) =>
        current.map((row) =>
          row._id === ticketId
            ? {
                ...row,
                lastReplyAt: message.createdAt ?? row.lastReplyAt,
              }
            : row,
        ),
      );
      setReply("");
      adminToast(internal ? "Internal note added." : "Reply sent.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reply failed.", false);
      try {
        await refreshDetailMessages(ticketId);
      } catch {
        // Keep optimistic state cleared on hard failure above.
      }
    } finally {
      setBusy(false);
    }
  }

  async function onStatusChange(newStatus: TicketStatus) {
    if (!selected || selected.status === newStatus) return;
    const previousStatus = selected.status;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await updateTicketStatus(selected._id, newStatus);
      setSelected(updated);
      syncDetailCache(detailCacheRef.current, updated, messages);
      setTickets((current) =>
        mergeTicketAfterAction(current, updated, status),
      );
      setOverview((current) =>
        current
          ? patchOverviewStatus(current, previousStatus, updated.status)
          : current,
      );
      if (assignedToMe) {
        scheduleListSync();
      }
      adminToast(`Status set to ${newStatus.replace("_", " ")}.`, true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Status update failed.", false);
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(adminId: string) {
    if (!selected || !adminId) return;
    const wasUnassigned = !selected.assignedAdminId;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await assignTicket(selected._id, adminId);
      setSelected(updated);
      syncDetailCache(detailCacheRef.current, updated, messages);
      setTickets((current) =>
        current.map((row) => (row._id === updated._id ? updated : row)),
      );
      setOverview((current) =>
        current
          ? patchOverviewAssign(
              current,
              wasUnassigned,
              !updated.assignedAdminId,
            )
          : current,
      );
      if (assignedToMe) {
        scheduleListSync();
      }
      adminToast("Ticket assigned.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Assign failed.", false);
    } finally {
      setBusy(false);
    }
  }

  function staffLabel(member: StaffMember) {
    return member.displayName
      ? `${member.displayName} (${member.email})`
      : member.email;
  }

  function assigneeLabel(adminId?: string) {
    if (!adminId) return "Unassigned";
    const member = staffById.get(adminId);
    return member ? staffLabel(member) : `…${adminId.slice(-6)}`;
  }

  const filtersActive = Boolean(status || assignedToMe);
  const activeQueue =
    (overview?.open ?? 0) + (overview?.inProgress ?? 0);

  return (
    <AdminPageLayout
      section="Support"
      title="Support tickets"
      description="Create, reply, assign, and track ticket status across your support queue."
      icon={ReceiptIcon}
      backHref="/admin"
      backLabel="Dashboard"
      action={
        overview && overview.unassigned > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            {overview.unassigned.toLocaleString()} unassigned
          </span>
        ) : null
      }
    >

      <AdminOrderPageIntro
        icon={<ReceiptIcon className="h-4 w-4" />}
        title="Support queue"
        subtitle={
          overview
            ? `${activeQueue.toLocaleString()} active · ${overview.unassigned.toLocaleString()} unassigned`
            : "Loading ticket overview…"
        }
        quickLinks={SUPPORT_QUICK_LINKS}
        quickNavLabel="Support shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <AdminOrderListCard
            icon={<ReceiptIcon className="h-4 w-4" />}
            title="Ticket list"
            subtitle={
              loading
                ? "Loading tickets…"
                : `${tickets.length.toLocaleString()} ticket${tickets.length === 1 ? "" : "s"} shown`
            }
            className="admin-tickets-catalog"
          >
            {overview ? (
              <>
                <AdminOrderStatsGrid>
                  <AdminOrderStatField
                    icon={<ReceiptIcon className="h-4 w-4" />}
                    label="Total tickets"
                    value={overview.total.toLocaleString()}
                    meta="All submissions"
                  />
                  <button
                    type="button"
                    aria-pressed={status === "open"}
                    onClick={() => toggleStatusFilter("open")}
                    className={clickableStatClass(status === "open")}
                  >
                    <span className="admin-products-stat-icon" aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          d="M8 10h8M8 14h5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <dt>Open</dt>
                      <dd>{overview.open.toLocaleString()}</dd>
                      <p className="admin-products-stat-meta">Awaiting response</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={status === "in_progress"}
                    onClick={() => toggleStatusFilter("in_progress")}
                    className={clickableStatClass(status === "in_progress")}
                  >
                    <span className="admin-products-stat-icon" aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <dt>In progress</dt>
                      <dd>{overview.inProgress.toLocaleString()}</dd>
                      <p className="admin-products-stat-meta">Being handled</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={status === "resolved"}
                    onClick={() => toggleStatusFilter("resolved")}
                    className={clickableStatClass(status === "resolved")}
                  >
                    <span className="admin-products-stat-icon" aria-hidden>
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt>Resolved</dt>
                      <dd>{overview.resolved.toLocaleString()}</dd>
                      <p className="admin-products-stat-meta">Completed work</p>
                    </div>
                  </button>
                </AdminOrderStatsGrid>

                <div className="admin-tickets-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                  <span>
                    <span className="font-semibold text-foreground">Active queue</span>{" "}
                    {activeQueue.toLocaleString()} open + in progress
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Pending</span>{" "}
                    {overview.pending.toLocaleString()}
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Unassigned</span>{" "}
                    {overview.unassigned.toLocaleString()}
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Closed</span>{" "}
                    {overview.closed.toLocaleString()}
                  </span>
                </div>
              </>
            ) : null}

            <div className="admin-products-filters-list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {filtersActive ? (
                  <>
                    <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex">
                      Filters active
                    </span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="dashboard-pro-btn-ghost shrink-0 text-xs"
                    >
                      Reset filters
                    </button>
                  </>
                ) : null}
              </div>

              <div className="admin-products-filters-row">
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="ticket-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <AdminSelect
                    id="ticket-status"
                    value={status}
                    onChange={(value) => setStatus(value as TicketStatus | "")}
                    className="w-full"
                    options={[
                      { value: "", label: "All statuses" },
                      ...STATUSES.map((item) => ({
                        value: item,
                        label: item.replace("_", " "),
                      })),
                    ]}
                  />
                </div>
                <div className="admin-products-filter-field min-w-0 flex items-end">
                  <label className="flex min-h-[42px] items-center gap-2 text-sm text-foreground-muted">
                    <input
                      type="checkbox"
                      checked={assignedToMe}
                      onChange={(e) => setAssignedToMe(e.target.checked)}
                      className="rounded border-border-strong"
                    />
                    Assigned to me
                  </label>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="admin-products-table-empty">Loading tickets…</div>
            ) : tickets.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <ReceiptIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No tickets found
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try clearing filters or choosing a different status."
                    : "New support tickets will appear here."}
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap admin-tickets-table-wrap overflow-x-auto">
                <table className="admin-tickets-table w-full">
                <thead className="admin-tickets-table-head">
                  <tr>
                    <th>Ticket</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket._id}
                      onClick={() => void openDetail(ticket._id)}
                      className="cursor-pointer"
                    >
                      <td className="font-mono text-xs font-semibold text-foreground">
                        {ticket.ticketNumber}
                      </td>
                      <td className="max-w-[280px] truncate text-sm">
                        {ticket.subject}
                      </td>
                      <td
                        className={`text-xs font-semibold capitalize ${
                          PRIORITY_STYLE[ticket.priority] ?? ""
                        }`}
                      >
                        {ticket.priority}
                      </td>
                      <td>
                        <span
                          className={`capitalize ${
                            STATUS_STYLE[ticket.status] ?? "dashboard-pro-status"
                          }`}
                        >
                          {ticket.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="text-xs text-foreground-muted">
                        {assigneeLabel(ticket.assignedAdminId)}
                      </td>
                      <td className="text-xs text-foreground-muted">
                        {ticket.lastReplyAt
                          ? new Date(ticket.lastReplyAt).toLocaleDateString()
                          : ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleDateString()
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </AdminOrderListCard>
        }
        sidebar={
          <ProductFormOrderCard
            className="admin-product-form-section admin-tickets-config"
            title="Ticket config"
            subtitle="Statuses, staff, and queue health"
          >
            <div className="space-y-4 text-xs text-foreground-muted">
              <div>
                <p>
                  <span className="text-subtle">Statuses:</span> open, in_progress,
                  pending, resolved, closed
                </p>
                <p className="mt-1">
                  <span className="text-subtle">Priorities:</span> low, medium, high,
                  urgent
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Staff ({staff.length})
                </p>
                <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px]">
                  {staff.length === 0 ? (
                    <li className="text-subtle">No staff loaded</li>
                  ) : (
                    staff.map((member) => (
                      <li key={member.id} className="truncate">
                        {member.displayName ?? member.email}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-foreground">Queue health</p>
                <p className="mt-2">
                  Active queue: {activeQueue.toLocaleString()}
                </p>
                <p>
                  Needs assignment: {overview?.unassigned.toLocaleString() ?? "—"}
                </p>
                <p className="mt-2">
                  Filter: {statusLabel(status)}
                  {assignedToMe ? " · assigned to me" : ""}
                </p>
              </div>
            </div>
          </ProductFormOrderCard>
        }
      />

      {selected ? (
        <TicketDrawer title="Ticket detail" onClose={closePanel} busy={busy}>
          <div className="space-y-1">
            <p className="font-mono text-xs text-brand">{selected.ticketNumber}</p>
            <h3 className="text-base font-semibold text-foreground">
              {selected.subject}
            </h3>
            <p className="text-xs text-subtle">
              {selected.category ?? "General"} · {selected.priority} priority
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ticket-drawer-status" className={labelCls}>
                Status
              </label>
              <AdminSelect
                id="ticket-drawer-status"
                value={selected.status}
                disabled={busy}
                onChange={(value) => onStatusChange(value as TicketStatus)}
                className="w-full"
                options={STATUSES.map((item) => ({
                  value: item,
                  label: item.replace("_", " "),
                }))}
              />
            </div>
            <div>
              <label htmlFor="ticket-drawer-assign" className={labelCls}>
                Assign to
              </label>
              <AdminSelect
                id="ticket-drawer-assign"
                value={selected.assignedAdminId ?? ""}
                disabled={busy}
                onChange={(value) => {
                  if (value) void onAssign(value);
                }}
                className="w-full"
                options={[
                  { value: "", label: "Unassigned" },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: staffLabel(member),
                  })),
                ]}
              />
            </div>
          </div>

          <div className="admin-tickets-thread mt-5 space-y-3">
            {messages.length === 0 ? (
              <div className="dashboard-pro-empty py-10">
                <p className="text-sm text-subtle">No messages yet.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message._id}
                  className={`admin-tickets-message rounded-xl border p-3 ${
                    message.internal
                      ? "border-amber-500/20 bg-amber-500/5"
                      : message.senderRole === "admin" ||
                          message.senderRole === "support"
                        ? "border-brand/20 bg-brand/5"
                        : "border-border bg-sunken/20"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase text-subtle">
                    {message.senderRole}
                    {message.internal ? " · internal" : ""}
                    {message.createdAt
                      ? ` · ${new Date(message.createdAt).toLocaleString()}`
                      : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {message.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={onReply}
            className="admin-tickets-reply mt-5 space-y-3 border-t border-border/45 pt-5"
          >
            <div>
              <label htmlFor="ticket-reply" className={labelCls}>
                Reply
              </label>
              <textarea
                id="ticket-reply"
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                className={`${inputCls} min-h-[5rem] resize-y text-sm`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="rounded border-border-strong"
                />
                Internal note (hidden from customer)
              </label>
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? "Sending…" : internal ? "Add note" : "Send reply"}
              </button>
            </div>
          </form>
        </TicketDrawer>
      ) : null}
    </AdminPageLayout>
  );
}

function TicketDrawer({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-tickets-drawer fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close ticket panel"
        className="admin-tickets-drawer-backdrop flex-1 bg-black/50"
        onClick={onClose}
        disabled={busy}
      />
      <div className="admin-tickets-drawer-panel flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-elevated">
        <div className="shrink-0 border-b border-border/45 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="dashboard-pro-btn-ghost text-xs"
            >
              Close
            </button>
          </div>
        </div>
        <div className="admin-tickets-drawer-body flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
