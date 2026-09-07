"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderStatField,
  AdminOrderStatsGrid,
} from "@/components/admin/admin-order-page-shell";
import { BoxIcon, CheckIcon, MailIcon } from "@/components/admin/icons";
import { adminToast } from "@/lib/admin-toast";
import {
  deleteProductRequest,
  listProductRequestsAdmin,
  replyProductRequest,
  type ProductRequestItem,
} from "@/lib/api";

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminProductRequestsPage() {
  const [items, setItems] = useState<ProductRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductRequestItem | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProductRequestsAdmin(1, 100);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to load product requests",
        false,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openDetail(item: ProductRequestItem) {
    setSelected(item);
    setReply(item.adminReply ?? "");
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
      const updated = await replyProductRequest(selected.id, reply.trim());
      setSelected(updated);
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

  async function onDelete(item: ProductRequestItem) {
    if (
      !confirm(
        `Delete the product request for "${item.productName}" from ${item.customerName}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteProductRequest(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      if (selected?.id === item.id) {
        setSelected(null);
        setReply("");
      }
      adminToast("Product request deleted");
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to delete request",
        false,
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    setCheckedIds((current) =>
      current.size === items.length
        ? new Set()
        : new Set(items.map((item) => item.id)),
    );
  }

  async function onDeleteChecked() {
    const ids = items
      .filter((item) => checkedIds.has(item.id))
      .map((item) => item.id);
    if (ids.length === 0 || busy) return;
    if (
      !confirm(
        `Delete ${ids.length} selected product request${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deleteProductRequest(id)),
      );
      const deleted = new Set(
        ids.filter((_, i) => results[i]?.status === "fulfilled"),
      );
      const failed = ids.length - deleted.size;
      setItems((current) => current.filter((item) => !deleted.has(item.id)));
      setTotal((current) => Math.max(0, current - deleted.size));
      setCheckedIds(new Set());
      if (selected && deleted.has(selected.id)) {
        setSelected(null);
        setReply("");
      }
      if (failed > 0) {
        adminToast(
          `Deleted ${deleted.size}, but ${failed} request${failed === 1 ? "" : "s"} could not be deleted`,
          false,
        );
      } else {
        adminToast(
          `${deleted.size} request${deleted.size === 1 ? "" : "s"} deleted`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = items.filter((item) => !item.adminReply).length;
  const repliedCount = items.filter((item) => item.adminReply).length;
  const checkedCount = items.filter((item) => checkedIds.has(item.id)).length;
  const allChecked = items.length > 0 && checkedCount === items.length;

  return (
    <AdminPageLayout
      section="Support"
      title="Product requests"
      description="Review customer product requests, reply by email, and clean up handled entries."
      icon={BoxIcon}
      backHref="/admin"
      backLabel="Dashboard"
    >
      <AdminOrderListCard
        icon={<BoxIcon className="h-4 w-4" />}
        title="Request list"
        subtitle={
          loading
            ? "Loading product requests…"
            : `${items.length.toLocaleString()} request${items.length === 1 ? "" : "s"} shown`
        }
      >
        <AdminOrderStatsGrid>
          <AdminOrderStatField
            icon={<BoxIcon className="h-4 w-4" />}
            label="Total requests"
            value={total.toLocaleString()}
            meta="All submissions"
          />
          <AdminOrderStatField
            icon={<MailIcon className="h-4 w-4" />}
            label="Awaiting reply"
            value={pendingCount.toLocaleString()}
            meta="No admin reply yet"
          />
          <AdminOrderStatField
            icon={<CheckIcon className="h-4 w-4" />}
            label="Replied"
            value={repliedCount.toLocaleString()}
            meta="Customer emailed"
          />
        </AdminOrderStatsGrid>

        {loading ? (
          <div className="admin-products-table-empty">
            Loading product requests…
          </div>
        ) : items.length === 0 ? (
          <div className="dashboard-pro-empty px-4 py-8">
            <span className="dashboard-pro-empty-icon" aria-hidden>
              <BoxIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              No product requests yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-foreground-muted">
              Customer requests submitted from the storefront will appear here.
            </p>
          </div>
        ) : (
          <div className="admin-products-table-wrap admin-tickets-table-wrap overflow-x-auto">
            {checkedCount > 0 ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-sunken/20 px-4 py-2.5">
                <span className="text-xs font-semibold text-foreground">
                  {checkedCount} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckedIds(new Set())}
                    disabled={busy}
                    className="dashboard-pro-btn-ghost text-xs"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteChecked()}
                    disabled={busy}
                    className="inline-flex items-center rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {busy ? "Deleting…" : `Delete selected (${checkedCount})`}
                  </button>
                </div>
              </div>
            ) : null}
            <table className="admin-tickets-table w-full">
              <thead className="admin-tickets-table-head">
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleCheckAll}
                      aria-label="Select all requests"
                      className="rounded border-border-strong"
                    />
                  </th>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="cursor-pointer"
                  >
                    <td onClick={(e) => e.stopPropagation()} className="w-10">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(item.id)}
                        onChange={() => toggleChecked(item.id)}
                        aria-label={`Select request for ${item.productName}`}
                        className="rounded border-border-strong"
                      />
                    </td>
                    <td className="max-w-[240px] truncate text-sm font-semibold text-foreground">
                      {item.productName}
                    </td>
                    <td className="max-w-[160px] truncate text-sm">
                      {item.customerName}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-foreground-muted">
                      {item.email}
                    </td>
                    <td className="text-xs text-foreground-muted">
                      {item.mobile}
                    </td>
                    <td>
                      <span
                        className={
                          item.adminReply
                            ? "dashboard-pro-status dashboard-pro-status--green"
                            : "dashboard-pro-status dashboard-pro-status--amber"
                        }
                      >
                        {item.adminReply ? "replied" : "pending"}
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
            aria-label="Close request panel"
            className="admin-tickets-drawer-backdrop flex-1 bg-black/50"
            onClick={closeDetail}
            disabled={busy}
          />
          <div className="admin-tickets-drawer-panel flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-elevated">
            <div className="shrink-0 border-b border-border/45 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Product request
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
                  {selected.productName}
                </h3>
                <p className="text-xs text-subtle">
                  Submitted {formatDate(selected.createdAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className={labelCls}>Customer</p>
                  <p className="text-sm text-foreground">
                    {selected.customerName}
                  </p>
                </div>
                <div>
                  <p className={labelCls}>Mobile</p>
                  <p className="text-sm text-foreground">{selected.mobile}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className={labelCls}>Email</p>
                  <p className="break-all text-sm text-foreground">
                    {selected.email}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className={labelCls}>Product details</p>
                <div className="rounded-xl border border-border bg-sunken/20 p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {selected.details}
                  </p>
                </div>
              </div>

              {selected.adminReply ? (
                <div className="mt-4">
                  <p className={labelCls}>
                    Last reply{" "}
                    {selected.repliedAt
                      ? `· ${formatDate(selected.repliedAt)}`
                      : ""}
                  </p>
                  <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {selected.adminReply}
                    </p>
                  </div>
                </div>
              ) : null}

              <form
                onSubmit={onReply}
                className="mt-5 space-y-3 border-t border-border/45 pt-5"
              >
                <div>
                  <label htmlFor="product-request-reply" className={labelCls}>
                    {selected.adminReply ? "Send another reply" : "Reply"}
                  </label>
                  <textarea
                    id="product-request-reply"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply — it will be emailed to the customer…"
                    className="admin-input min-h-[5rem] w-full resize-y text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void onDelete(selected)}
                    disabled={busy}
                    className="dashboard-pro-btn-ghost text-xs text-rose-300 hover:text-rose-200"
                  >
                    Delete request
                  </button>
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
