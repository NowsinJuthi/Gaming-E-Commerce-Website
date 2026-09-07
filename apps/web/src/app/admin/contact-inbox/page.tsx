"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderStatField,
  AdminOrderStatsGrid,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CheckIcon, MailIcon } from "@/components/admin/icons";
import { adminToast } from "@/lib/admin-toast";
import {
  deleteContactInquiry,
  getContactInquiryAdmin,
  listContactInquiriesAdmin,
  replyContactInquiry,
  updateContactInquiryStatus,
  type ContactInquiryItem,
  type ContactInquiryStatus,
} from "@/lib/api";

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

const STATUS_OPTIONS: { value: ContactInquiryStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "closed", label: "Closed" },
];

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function statusBadgeClass(status: ContactInquiryStatus) {
  switch (status) {
    case "new":
      return "dashboard-pro-status dashboard-pro-status--amber";
    case "read":
      return "dashboard-pro-status dashboard-pro-status--brand";
    case "replied":
      return "dashboard-pro-status dashboard-pro-status--green";
    case "closed":
      return "dashboard-pro-status";
    default:
      return "dashboard-pro-status";
  }
}

export default function AdminContactInboxPage() {
  const [items, setItems] = useState<ContactInquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContactInquiryStatus | "">(
    "",
  );
  const [selected, setSelected] = useState<ContactInquiryItem | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContactInquiriesAdmin(
        1,
        100,
        statusFilter || undefined,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to load contact messages",
        false,
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(item: ContactInquiryItem) {
    setBusy(true);
    try {
      const detail = await getContactInquiryAdmin(item.id);
      setSelected(detail);
      setReply("");
      setItems((current) =>
        current.map((row) => (row.id === detail.id ? detail : row)),
      );
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to open message",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    if (busy) return;
    setSelected(null);
    setReply("");
  }

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    try {
      const updated = await replyContactInquiry(selected.id, reply.trim());
      setSelected(updated);
      setReply("");
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      adminToast("Reply sent to customer email");
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to send reply",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onStatusChange(status: ContactInquiryStatus) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const updated = await updateContactInquiryStatus(selected.id, status);
      setSelected(updated);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      adminToast(`Marked as ${status}`);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to update status",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item: ContactInquiryItem) {
    if (
      !confirm(
        `Delete the message from ${item.name} about "${item.subject}"?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteContactInquiry(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      if (selected?.id === item.id) {
        setSelected(null);
        setReply("");
      }
      adminToast("Message deleted");
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to delete message",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  const newCount = items.filter((item) => item.status === "new").length;
  const repliedCount = items.filter((item) => item.status === "replied").length;

  return (
    <AdminPageLayout
      section="Support"
      title="Email inbox"
      description="Read contact form messages and reply to customers by email from the dashboard."
      icon={MailIcon}
      backHref="/admin"
      backLabel="Dashboard"
    >
      <AdminOrderListCard
        icon={<MailIcon className="h-4 w-4" />}
        title="Contact messages"
        subtitle={
          loading
            ? "Loading messages…"
            : `${items.length.toLocaleString()} message${items.length === 1 ? "" : "s"} shown`
        }
      >
        <AdminOrderStatsGrid>
          <AdminOrderStatField
            icon={<MailIcon className="h-4 w-4" />}
            label="Total messages"
            value={total.toLocaleString()}
            meta="All contact emails"
          />
          <AdminOrderStatField
            icon={<MailIcon className="h-4 w-4" />}
            label="New"
            value={newCount.toLocaleString()}
            meta="Unread in this view"
          />
          <AdminOrderStatField
            icon={<CheckIcon className="h-4 w-4" />}
            label="Replied"
            value={repliedCount.toLocaleString()}
            meta="Customer emailed"
          />
        </AdminOrderStatsGrid>

        <div className="mb-4 max-w-xs">
          <label className={labelCls}>Filter</label>
          <AdminSelect
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as ContactInquiryStatus | "")
            }
            options={STATUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </div>

        {loading ? (
          <div className="admin-products-table-empty">Loading messages…</div>
        ) : items.length === 0 ? (
          <div className="dashboard-pro-empty px-4 py-8">
            <span className="dashboard-pro-empty-icon" aria-hidden>
              <MailIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              No contact messages yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-foreground-muted">
              Messages sent through the contact email form will appear here.
            </p>
          </div>
        ) : (
          <div className="admin-products-table-wrap admin-tickets-table-wrap overflow-x-auto">
            <table className="admin-tickets-table w-full">
              <thead className="admin-tickets-table-head">
                <tr>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => void openDetail(item)}
                    className="cursor-pointer"
                  >
                    <td className="max-w-[260px] truncate text-sm font-semibold text-foreground">
                      {item.subject}
                    </td>
                    <td className="max-w-[160px] truncate text-sm">
                      {item.name}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-foreground-muted">
                      {item.email}
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>
                        {item.status}
                      </span>
                    </td>
                    <td className="text-xs text-foreground-muted">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminOrderListCard>

      {selected ? (
        <div className="admin-tickets-drawer fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close message panel"
            className="admin-tickets-drawer-backdrop flex-1 bg-black/50"
            onClick={closeDetail}
            disabled={busy}
          />
          <div className="admin-tickets-drawer-panel flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-elevated">
            <div className="shrink-0 border-b border-border/45 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Contact message
                </h2>
                <button
                  type="button"
                  onClick={closeDetail}
                  disabled={busy}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="admin-tickets-drawer-body flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {selected.subject}
                </h3>
                <p className="text-xs text-subtle">
                  Received {formatDate(selected.createdAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className={labelCls}>Customer</p>
                  <p className="text-sm text-foreground">{selected.name}</p>
                </div>
                <div>
                  <p className={labelCls}>Status</p>
                  <span className={statusBadgeClass(selected.status)}>
                    {selected.status}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <p className={labelCls}>Email</p>
                  <a
                    href={`mailto:${selected.email}`}
                    className="break-all text-sm text-brand hover:underline"
                  >
                    {selected.email}
                  </a>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className={labelCls}>Conversation</p>
                {selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.direction === "outbound"
                        ? "rounded-xl border border-brand/20 bg-brand/5 p-3"
                        : "rounded-xl border border-border bg-sunken/20 p-3"
                    }
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                      {message.direction === "outbound"
                        ? "Your reply"
                        : "Customer"}{" "}
                      · {formatDate(message.sentAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {message.body}
                    </p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={onReply}
                className="mt-5 space-y-3 border-t border-border/45 pt-5"
              >
                <div>
                  <label htmlFor="contact-inbox-reply" className={labelCls}>
                    Reply by email
                  </label>
                  <textarea
                    id="contact-inbox-reply"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply — it will be emailed to the customer…"
                    className="admin-input min-h-[5rem] w-full resize-y text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onDelete(selected)}
                      disabled={busy}
                      className="dashboard-pro-btn-ghost text-xs text-rose-300 hover:text-rose-200"
                    >
                      Delete
                    </button>
                    {selected.status !== "closed" ? (
                      <button
                        type="button"
                        onClick={() => void onStatusChange("closed")}
                        disabled={busy}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Mark closed
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !reply.trim()}
                    className="btn-primary disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send reply email"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageLayout>
  );
}
