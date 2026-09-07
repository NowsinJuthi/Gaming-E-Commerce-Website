"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  ChartIcon,
  CheckIcon,
  CreditCardIcon,
  DollarIcon,
  PulseIcon,
  WalletIcon,
} from "@/components/admin/icons";
import {
  adminListOrders,
  formatPrice,
  getAdminReports,
  getAdminRevenue,
  type AdminRevenue,
  type OrderDetail,
  type PaymentMethodValue,
} from "@/lib/api";
import { formatAdminOrderRef } from "@/lib/admin-order-ui";
import {
  ADMIN_PAYMENT_STATUS_STYLE,
  formatAdminPaymentDate,
  formatAdminPaymentMethod,
  formatAdminPaymentStatus,
  PAYMENT_STATUS_TABS,
  type PaymentView,
} from "@/lib/admin-payment-ui";

type DateRange = "all" | "today" | "7d" | "30d" | "month";

const PAYMENTS_PAGE_SIZE = 20;

const DATE_OPTIONS: Array<{ id: DateRange; label: string }> = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

const METHOD_OPTIONS: Array<{ id: PaymentMethodValue | "all"; label: string }> =
  [
    { id: "all", label: "All methods" },
    { id: "wallet", label: "Wallet" },
    { id: "gateway", label: "Gateway" },
    { id: "manual", label: "Manual / bank" },
  ];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function orderPayment(order: OrderDetail) {
  return (
    order.payment ?? {
      method: "manual" as PaymentMethodValue,
      status: "pending",
    }
  );
}

function matchesDateRange(
  createdAt: string | undefined,
  paidAt: string | undefined,
  range: DateRange,
) {
  if (range === "all") return true;
  const value = paidAt ?? createdAt;
  if (!value) return false;
  const at = new Date(value);
  const now = new Date();
  if (range === "today") return at >= startOfToday();
  if (range === "7d") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    return at >= cutoff;
  }
  if (range === "30d") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    return at >= cutoff;
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return at >= monthStart;
}

function matchesPaymentView(order: OrderDetail, view: PaymentView): boolean {
  if (view === "all") return true;
  return (order.payment?.status ?? "pending") === view;
}

function countPaymentViews(orders: OrderDetail[]) {
  const counts: Record<PaymentView, number> = {
    all: 0,
    paid: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
  };
  for (const order of orders) {
    const status = order.payment?.status ?? "pending";
    if (status === "paid") counts.paid += 1;
    else if (status === "pending") counts.pending += 1;
    else if (status === "failed") counts.failed += 1;
    else if (status === "refunded") counts.refunded += 1;
  }
  return counts;
}

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

type PaymentStatTone = "brand" | "success" | "amber" | "muted";

type PaymentOverviewItem = {
  key: string;
  tone: PaymentStatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: ReactNode;
};

function PaymentOverviewStats({
  items,
}: {
  items: PaymentOverviewItem[];
}) {
  return (
    <section
      className="customer-dashboard-overview-section admin-payments-overview"
      aria-label="Payment overview"
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

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [sampleOrders, setSampleOrders] = useState<OrderDetail[]>([]);
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [methodBreakdown, setMethodBreakdown] = useState<
    Array<{ method: string; count: number; total: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<PaymentView>("all");
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [draftDate, setDraftDate] = useState<DateRange>("all");
  const [draftMethod, setDraftMethod] = useState<PaymentMethodValue | "all">(
    "all",
  );
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedDate, setAppliedDate] = useState<DateRange>("all");
  const [appliedMethod, setAppliedMethod] = useState<PaymentMethodValue | "all">(
    "all",
  );
  const [appliedSearch, setAppliedSearch] = useState("");

  const filtersActive =
    appliedDate !== "all" ||
    appliedMethod !== "all" ||
    appliedSearch.trim().length > 0;

  const loadSummary = useCallback(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    void Promise.all([
      getAdminRevenue().catch(() => null),
      getAdminReports({
        from: from.toISOString(),
        to: to.toISOString(),
      }).catch(() => null),
      adminListOrders({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
    ]).then(([rev, reports, sample]) => {
      setRevenue(rev);
      setMethodBreakdown(reports?.paymentBreakdown ?? []);
      setSampleOrders(sample.items ?? []);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void adminListOrders({
      q: appliedSearch.trim() || undefined,
      page,
      limit: PAYMENTS_PAGE_SIZE,
    })
      .then((result) => {
        setOrders(result.items ?? []);
        setListTotal(result.total ?? 0);
      })
      .catch((err) => {
        setOrders([]);
        setListTotal(0);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load payments",
        );
      })
      .finally(() => setLoading(false));
  }, [appliedSearch, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    load();
  }, [load]);

  const sampleCounts = useMemo(
    () => countPaymentViews(sampleOrders),
    [sampleOrders],
  );

  const tabCounts: Record<PaymentView, number> = {
    all: listTotal,
    paid: sampleCounts.paid,
    pending: sampleCounts.pending,
    failed: sampleCounts.failed,
    refunded: sampleCounts.refunded,
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const payment = orderPayment(order);
      if (!matchesPaymentView(order, view)) return false;
      if (appliedMethod !== "all" && payment.method !== appliedMethod) {
        return false;
      }
      if (
        !matchesDateRange(order.createdAt, payment.paidAt, appliedDate)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, view, appliedMethod, appliedDate]);

  const displayedCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / PAYMENTS_PAGE_SIZE));
  const currency =
    revenue?.currency ?? orders[0]?.pricing?.currency ?? "BDT";

  function selectView(next: PaymentView) {
    setView(next);
    setPage(1);
  }

  function applyFilters() {
    setAppliedDate(draftDate);
    setAppliedMethod(draftMethod);
    setAppliedSearch(draftSearch);
    setPage(1);
  }

  function clearFilters() {
    setDraftDate("all");
    setDraftMethod("all");
    setDraftSearch("");
    setAppliedDate("all");
    setAppliedMethod("all");
    setAppliedSearch("");
    setPage(1);
  }

  const topMethod = methodBreakdown[0];

  const overviewItems = useMemo((): PaymentOverviewItem[] => {
    const items: PaymentOverviewItem[] = [
      {
        key: "net",
        tone: "amber",
        icon: <WalletIcon className="h-4 w-4" aria-hidden />,
        label: "Net revenue",
        value: revenue ? (
          <PriceText amount={revenue.net} currency={revenue.currency} />
        ) : (
          "—"
        ),
        meta: revenue
          ? `${formatPrice(revenue.today, revenue.currency)} today`
          : "All-time paid minus refunds",
      },
      {
        key: "paid",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" aria-hidden />,
        label: "Paid",
        value: sampleCounts.paid.toLocaleString(),
        meta: revenue
          ? `${formatPrice(revenue.total, revenue.currency)} gross`
          : "Recent sample",
      },
      {
        key: "pending",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" aria-hidden />,
        label: "Pending",
        value: sampleCounts.pending.toLocaleString(),
        meta: "Awaiting confirmation",
      },
      {
        key: "refunded",
        tone: "muted",
        icon: <DollarIcon className="h-4 w-4" aria-hidden />,
        label: "Refunded",
        value: sampleCounts.refunded.toLocaleString(),
        meta: revenue ? (
          <>
            <PriceText amount={revenue.refunded} currency={revenue.currency} />
            {" returned to customers"}
          </>
        ) : (
          "Returned to customers"
        ),
      },
    ];

    if (topMethod) {
      items.push(
        {
          key: "top-method",
          tone: "brand",
          icon: <CreditCardIcon className="h-4 w-4" aria-hidden />,
          label: "Top method (30d)",
          value: formatAdminPaymentMethod(
            topMethod.method as PaymentMethodValue,
          ),
          meta: "Most used checkout channel",
        },
        {
          key: "transactions",
          tone: "success",
          icon: <ChartIcon className="h-4 w-4" aria-hidden />,
          label: "Transactions",
          value: topMethod.count.toLocaleString(),
          meta: "Last 30 days",
        },
        {
          key: "volume",
          tone: "amber",
          icon: <WalletIcon className="h-4 w-4" aria-hidden />,
          label: "Volume",
          value: <PriceText amount={topMethod.total} currency={currency} />,
          meta: "Top method volume",
        },
        {
          key: "methods",
          tone: "muted",
          icon: <DollarIcon className="h-4 w-4" aria-hidden />,
          label: "Methods tracked",
          value: methodBreakdown.length.toLocaleString(),
          meta: "Active payment channels",
        },
      );
    }

    return items;
  }, [currency, methodBreakdown.length, revenue, sampleCounts, topMethod]);

  return (
    <AdminPageLayout
      section="Sales"
      title="Payments"
      description="Monitor transactions across wallet, gateway, and manual checkout."
      icon={DollarIcon}
      backHref="/admin/sales/orders"
      backLabel="Orders"
      action={
        <Link href="/admin/settings/payments" className="dashboard-pro-btn-ghost">
          Payment gateways
        </Link>
      }
    >
      <AdminOrderListCard
        icon={<DollarIcon className="h-4 w-4" />}
        title="Payments"
        subtitle={
          loading
            ? "Loading transactions…"
            : filtersActive
              ? `${displayedCount} transaction${displayedCount === 1 ? "" : "s"} on this page`
              : `${displayedCount} transaction${displayedCount === 1 ? "" : "s"} on page ${page}`
        }
      >
        <PaymentOverviewStats items={overviewItems} />

        {loadError ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={load}
              className="dashboard-pro-btn-ghost text-xs"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-4">
          <div
            role="tablist"
            aria-label="Payment status"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-strong/40 pb-4 text-sm"
          >
            {PAYMENT_STATUS_TABS.map((tab, index) => {
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
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectView(tab.id)}
                    className={
                      active
                        ? "font-semibold text-foreground"
                        : "text-brand hover:underline"
                    }
                  >
                    {tab.label} ({tabCounts[tab.id].toLocaleString()})
                  </button>
                </span>
              );
            })}
          </div>

          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-3">
            <div className="flex min-w-[9rem] shrink-0 flex-col justify-center">
              <p className="text-sm font-semibold text-foreground">
                Payment filters
              </p>
              <p className="mt-0.5 text-xs text-subtle">
                {loading
                  ? "Loading transactions…"
                  : filtersActive
                    ? `${displayedCount} transaction${displayedCount === 1 ? "" : "s"} on this page`
                    : `${displayedCount} transaction${displayedCount === 1 ? "" : "s"} on page ${page}`}
              </p>
              {filtersActive ? (
                <span className="panel-3d-badge-amber mt-1.5 inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Filters active
                </span>
              ) : null}
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="min-w-0">
                <label htmlFor="payment-date" className="sr-only">
                  Date range
                </label>
                <AdminSelect
                  id="payment-date"
                  value={draftDate}
                  onChange={(v) => setDraftDate(v as DateRange)}
                  className="w-full min-w-0"
                  options={DATE_OPTIONS.map((opt) => ({
                    value: opt.id,
                    label: opt.label,
                  }))}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="payment-method" className="sr-only">
                  Payment method
                </label>
                <AdminSelect
                  id="payment-method"
                  value={draftMethod}
                  onChange={(v) =>
                    setDraftMethod(v as PaymentMethodValue | "all")
                  }
                  className="w-full min-w-0"
                  options={METHOD_OPTIONS.map((opt) => ({
                    value: opt.id,
                    label: opt.label,
                  }))}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="payment-search" className="sr-only">
                  Search orders
                </label>
                <input
                  id="payment-search"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                  placeholder="Search order"
                  className="admin-input w-full"
                />
              </div>
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
              Apply filters
            </button>
          </div>
        </div>

        <div className="panel-3d-table-wrap overflow-x-auto">
        {loading ? (
          <div className="panel-3d-empty px-6 py-12">
            <p className="text-sm text-subtle">Loading transactions…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="panel-3d-empty px-6 py-12">
            <span className="dashboard-pro-empty-icon" aria-hidden>
              <DollarIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              No payments found
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Try another status tab or clear your filters.
            </p>
          </div>
        ) : (
          <table className="panel-3d-table admin-payments-table w-full text-sm">
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Paid</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const payment = orderPayment(order);
                const paymentStatus = payment.status ?? "pending";
                const pricing = order.pricing ?? {
                  total: 0,
                  currency,
                };
                return (
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
                      <PriceText amount={pricing.total} currency={pricing.currency ?? currency} />
                    </td>
                    <td className="text-foreground-muted">
                      {formatAdminPaymentMethod(payment.method)}
                    </td>
                    <td>
                      <span
                        className={
                          ADMIN_PAYMENT_STATUS_STYLE[paymentStatus] ??
                          "dashboard-pro-status"
                        }
                      >
                        {formatAdminPaymentStatus(paymentStatus)}
                      </span>
                    </td>
                    <td className="text-foreground-muted">
                      {formatAdminPaymentDate(
                        payment.paidAt,
                        order.createdAt,
                      )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>

        {!loading && listTotal > PAYMENTS_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3 text-sm">
            <p className="text-subtle">
              Page {page} of {totalPages} · {listTotal.toLocaleString()} orders
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
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
