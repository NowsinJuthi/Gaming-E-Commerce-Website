"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import {
  CheckIcon,
  ReceiptIcon,
  WalletIcon,
} from "@/components/admin/icons";
import {
  adminListOrders,
  formatPrice,
  getAdminRevenue,
  refundOrder,
  type AdminRevenue,
  type OrderDetail,
} from "@/lib/api";
import {
  ADMIN_ORDER_DETAIL_STATUS_STYLE,
  ADMIN_ORDER_STATUS_LABELS,
  formatAdminOrderRef,
  formatAdminOrderWhen,
} from "@/lib/admin-order-ui";

type RefundView = "delivered" | "processing" | "paid" | "refunded";

const DEFAULT_REFUND_TAB = {
  id: "delivered",
  label: "Completed",
  refundable: true,
} as const;

const REFUND_TABS: Array<{
  id: RefundView;
  label: string;
  refundable: boolean;
}> = [
  DEFAULT_REFUND_TAB,
  { id: "processing", label: "Processing", refundable: true },
  { id: "paid", label: "Paid", refundable: true },
  { id: "refunded", label: "Refunded", refundable: false },
];

const REFUNDS_PAGE_SIZE = 20;

function OrderViewIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M10 3.5c-3.5 0-6.5 2.2-8.2 5.5 1.7 3.3 4.7 5.5 8.2 5.5s6.5-2.2 8.2-5.5C16.5 5.7 13.5 3.5 10 3.5Zm0 9.2a3.7 3.7 0 1 1 0-7.4 3.7 3.7 0 0 1 0 7.4Zm0-1.8a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z" />
    </svg>
  );
}

type RefundStatTone = "brand" | "success" | "amber" | "muted";

type RefundOverviewItem = {
  key: string;
  tone: RefundStatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: ReactNode;
};

function RefundOverviewStats({ items }: { items: RefundOverviewItem[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-refunds-overview"
      aria-label="Refund overview"
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

export default function AdminRefundsPage() {
  const [view, setView] = useState<RefundView>("delivered");
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [counts, setCounts] = useState<Record<RefundView, number>>({
    delivered: 0,
    processing: 0,
    paid: 0,
    refunded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  
  const activeTab =
    REFUND_TABS.find((tab) => tab.id === view) ?? DEFAULT_REFUND_TAB;
  const filtersActive = appliedSearch.trim().length > 0;
  const refundableQueue =
    counts.delivered + counts.processing + counts.paid;

  const loadSummary = useCallback(() => {
    Promise.all([
      getAdminRevenue().catch(() => null),
      adminListOrders({ status: "delivered", limit: 1 }).catch(() => ({
        total: 0,
        items: [],
        page: 1,
        limit: 1,
      })),
      adminListOrders({ status: "processing", limit: 1 }).catch(() => ({
        total: 0,
        items: [],
        page: 1,
        limit: 1,
      })),
      adminListOrders({ status: "paid", limit: 1 }).catch(() => ({
        total: 0,
        items: [],
        page: 1,
        limit: 1,
      })),
      adminListOrders({ status: "refunded", limit: 1 }).catch(() => ({
        total: 0,
        items: [],
        page: 1,
        limit: 1,
      })),
    ])
      .then(([rev, delivered, processing, paid, refunded]) => {
        setRevenue(rev);
        setCounts({
          delivered: delivered.total,
          processing: processing.total,
          paid: paid.total,
          refunded: refunded.total,
        });
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminListOrders({
      status: view,
      q: appliedSearch.trim() || undefined,
      page,
      limit: REFUNDS_PAGE_SIZE,
    })
      .then((result) => {
        setOrders(result.items);
        setListTotal(result.total);
        setCounts((current) => ({ ...current, [view]: result.total }));
      })
      .catch(() => {
        setOrders([]);
        setListTotal(0);
      })
      .finally(() => setLoading(false));
  }, [appliedSearch, page, view]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(listTotal / REFUNDS_PAGE_SIZE));
  const pageStart =
    listTotal === 0 ? 0 : (page - 1) * REFUNDS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * REFUNDS_PAGE_SIZE, listTotal);

  function selectView(next: RefundView) {
    setView(next);
    setPage(1);
  }

  function applyFilters() {
    setAppliedSearch(draftSearch);
    setPage(1);
  }

  function clearFilters() {
    setDraftSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  async function doRefund(order: OrderDetail) {
    const reason =
      prompt(`Refund reason for ${order.orderNumber} (optional):`) ?? undefined;
    if (
      !confirm(
        `Refund ${formatPrice(order.pricing.total, order.pricing.currency)} for ${order.orderNumber}?`,
      )
    ) {
      return;
    }
    setBusyId(order._id);
    hideAdminToast();
    try {
      await refundOrder(order._id, reason);
      adminToast(`Refund queued for ${order.orderNumber}.`, true);
      window.setTimeout(() => {
        loadSummary();
        load();
      }, 1500);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Refund failed", false);
    } finally {
      setBusyId(null);
    }
  }

  const overviewItems = useMemo((): RefundOverviewItem[] => {
    return [
      {
        key: "refunded-amount",
        tone: "amber",
        icon: <ReceiptIcon className="h-4 w-4" aria-hidden />,
        label: "Refunded",
        value: revenue ? (
          <PriceText amount={revenue.refunded} currency={revenue.currency} />
        ) : (
          "—"
        ),
        meta: `${counts.refunded.toLocaleString()} refunded orders`,
      },
      {
        key: "queue",
        tone: "brand",
        icon: <WalletIcon className="h-4 w-4" aria-hidden />,
        label: "Refundable queue",
        value: refundableQueue.toLocaleString(),
        meta: "Completed, processing, and paid",
      },
      {
        key: "refunded-orders",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" aria-hidden />,
        label: "Refunded orders",
        value: counts.refunded.toLocaleString(),
        meta: "Refund history",
      },
    ];
  }, [counts.refunded, refundableQueue, revenue]);

  return (
    <AdminPageLayout
      section="Sales"
      title="Refunds"
      description="Review refundable orders and track completed refund activity."
      icon={ReceiptIcon}
      backHref="/admin/sales/orders"
      backLabel="Orders"
      action={
        activeTab.refundable && counts[view] > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            {counts[view].toLocaleString()} refundable
          </span>
        ) : null
      }
    >

      <AdminOrderListCard
        icon={<ReceiptIcon className="h-4 w-4" />}
        title="Refunds"
        subtitle={
          loading
            ? "Loading orders…"
            : filtersActive
              ? `${listTotal.toLocaleString()} order${listTotal === 1 ? "" : "s"} matching search`
              : `${listTotal.toLocaleString()} order${listTotal === 1 ? "" : "s"} in ${activeTab.label.toLowerCase()}`
        }
        className="admin-refunds-list"
      >
        <RefundOverviewStats items={overviewItems} />

        <div className="admin-refunds-toolbar w-full">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-strong/40 pb-4 text-sm">
            {REFUND_TABS.map((tab, index) => {
              const active = view === tab.id;
              return (
                <span key={tab.id} className="inline-flex items-center gap-2">
                  {index > 0 ? (
                    <span className="text-subtle" aria-hidden>
                      |
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => selectView(tab.id)}
                    className={
                      active
                        ? "font-semibold text-foreground"
                        : "text-brand hover:underline"
                    }
                  >
                    {tab.label} ({counts[tab.id].toLocaleString()})
                  </button>
                </span>
              );
            })}
          </div>

          <div className="admin-refunds-filter-row flex w-full flex-wrap items-center gap-x-3 gap-y-3">
            <div className="flex min-w-[9rem] shrink-0 flex-col justify-center">
              <h2 className="text-sm font-semibold text-foreground">
                {activeTab.refundable ? "Refundable orders" : "Refund history"}
              </h2>
              <p className="mt-0.5 text-xs text-subtle">
                {loading
                  ? "Loading orders…"
                  : filtersActive
                    ? `${listTotal.toLocaleString()} order${listTotal === 1 ? "" : "s"} matching search`
                    : `${listTotal.toLocaleString()} order${listTotal === 1 ? "" : "s"} in ${activeTab.label.toLowerCase()}`}
              </p>
              {filtersActive ? (
                <span className="panel-3d-badge-amber mt-1.5 inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Search active
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <input
                id="refunds-search"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search order"
                className="admin-input w-full"
              />
            </div>

            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="dashboard-pro-btn-ghost shrink-0 px-4 py-2 text-sm"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={applyFilters}
              className="btn-primary btn-primary-sm shrink-0 px-4 py-2 text-sm"
            >
              Apply search
            </button>
          </div>
        </div>
        </div>

        <div className="panel-3d-table-wrap admin-refunds-table-wrap overflow-x-auto">
        {loading ? (
          <div className="panel-3d-empty px-6 py-12">
            <p className="text-sm text-subtle">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="panel-3d-empty px-6 py-12">
            <span className="dashboard-pro-empty-icon" aria-hidden>
              <ReceiptIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              No orders found
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {activeTab.refundable
                ? "No refundable orders in this status."
                : "No refunded orders yet."}
            </p>
          </div>
        ) : (
          <table className="panel-3d-table admin-refunds-table w-full text-sm">
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount</th>
                {activeTab.refundable ? (
                  <>
                    <th>Status</th>
                    <th>Placed</th>
                    <th className="text-right">Action</th>
                  </>
                ) : (
                  <>
                    <th>Refund</th>
                    <th>Reason</th>
                    <th>Refunded</th>
                    <th className="text-right">View</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <Link
                      href={`/admin/sales/orders/${order._id}`}
                      className="font-mono font-semibold text-brand hover:underline"
                    >
                      {formatAdminOrderRef(order.orderNumber)}
                    </Link>
                  </td>
                  <td className="font-semibold text-foreground">
                    <PriceText amount={order.pricing.total} currency={order.pricing.currency} />
                  </td>
                  {activeTab.refundable ? (
                    <>
                      <td>
                        <span
                          className={
                            ADMIN_ORDER_DETAIL_STATUS_STYLE[order.status] ??
                            "dashboard-pro-status"
                          }
                        >
                          {ADMIN_ORDER_STATUS_LABELS[order.status] ??
                            order.status}
                        </span>
                      </td>
                      <td className="text-foreground-muted">
                        {formatAdminOrderWhen(order.createdAt)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={busyId === order._id}
                          onClick={() => doRefund(order)}
                          className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs text-rose-300 disabled:opacity-50"
                        >
                          {busyId === order._id ? "Refunding…" : "Refund"}
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-semibold text-rose-300">
                        {order.refund?.refundedAt ? (
                          <PriceText
                            amount={order.refund.amount ?? order.pricing.total}
                            currency={order.pricing.currency}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[14rem] truncate text-foreground-muted">
                        {order.refund?.reason?.trim() || "—"}
                      </td>
                      <td className="text-foreground-muted">
                        {order.refund?.refundedAt
                          ? formatAdminOrderWhen(order.refund.refundedAt)
                          : "—"}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/sales/orders/${order._id}`}
                          className="dashboard-pro-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                        >
                          <OrderViewIcon />
                          View
                        </Link>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        {!loading && listTotal > REFUNDS_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3 text-sm">
            <p className="text-subtle">
              Showing {pageStart}–{pageEnd} of {listTotal.toLocaleString()} orders
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || busyId != null}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || busyId != null}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </AdminOrderListCard>
    </AdminPageLayout>
  );
}
