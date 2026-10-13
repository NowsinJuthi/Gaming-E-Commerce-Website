"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CartIcon } from "@/components/admin/icons";
import {
  adminDeleteOrder,
  adminGetCustomer,
  adminListOrders,
  getOrderLocks,
  refundOrder,
  restoreOrder,
  updateOrderStatus,
  type OrderDetail,
  type OrderLockInfo,
  type OrderStatusValue,
  type PaymentMethodValue,
} from "@/lib/api";
import { useOnStoreEvent } from "@/hooks/useOnStoreEvent";
import {
  ADMIN_ORDER_STATUS_LABELS,
  ADMIN_ORDER_STATUS_STYLE,
  adminOrderOrigin,
  formatAdminOrderRef,
} from "@/lib/admin-order-ui";
import {
  getCustomerDisplayName,
  resolveOrderCustomerLabel,
} from "@/lib/admin-order-view";

type OrderView =
  | "all"
  | "pending"
  | "paid"
  | "completed"
  | "cancelled"
  | "refunded"
  | "trash";

type DateRange = "all" | "today" | "7d" | "30d" | "month";

type BulkAction = "" | "processing" | "delivered" | "cancelled" | "failed" | "refund" | "delete" | "restore";

type SortKey = "order" | "date" | "total";

type SortDir = "asc" | "desc";

const VIEW_STATUS: Record<Exclude<OrderView, "all">, OrderStatusValue> = {
  pending: "pending",
  paid: "paid",
  completed: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
  trash: "failed",
};


const ORDERS_PAGE_SIZE = 20;

const DATE_OPTIONS: Array<{ id: DateRange; label: string }> = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

const CHANNEL_OPTIONS: Array<{ id: PaymentMethodValue | "all"; label: string }> =
  [
    { id: "all", label: "All sales channels" },
    { id: "wallet", label: "Wallet" },
    { id: "gateway", label: "Gateway" },
    { id: "manual", label: "Manual / bank" },
  ];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatOrderWhen(createdAt?: string): string {
  if (!createdAt) return "—";
  const at = new Date(createdAt);
  const diffMs = Date.now() - at.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) {
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={`inline-flex flex-col leading-none ${
        active ? "text-brand" : "text-subtle opacity-70"
      }`}
      aria-hidden
    >
      <span className={active && dir === "asc" ? "text-brand" : ""}>▴</span>
      <span className={`-mt-1 ${active && dir === "desc" ? "text-brand" : ""}`}>
        ▾
      </span>
    </span>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 font-semibold text-inherit hover:text-brand ${
          className.includes("text-right") ? "w-full justify-end" : ""
        }`}
      >
        {label}
        <SortIcon active={activeKey === sortKey} dir={dir} />
      </button>
    </th>
  );
}

function matchesDateRange(createdAt: string | undefined, range: DateRange) {
  if (range === "all" || !createdAt) return true;
  const at = new Date(createdAt);
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  // Map of orderId → lock info for orders currently being edited by someone
  const [lockedOrders, setLockedOrders] = useState<Record<string, OrderLockInfo>>({});
  const [view, setView] = useState<OrderView>("all");
  const [counts, setCounts] = useState<Record<OrderView, number>>({
    all: 0,
    pending: 0,
    paid: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
    trash: 0,
  });
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [draftDate, setDraftDate] = useState<DateRange>("all");
  const [draftChannel, setDraftChannel] = useState<PaymentMethodValue | "all">(
    "all",
  );
  const [draftCustomerQ, setDraftCustomerQ] = useState("");
  const [appliedDate, setAppliedDate] = useState<DateRange>("all");
  const [appliedChannel, setAppliedChannel] = useState<
    PaymentMethodValue | "all"
  >("all");
  const [appliedCustomerQ, setAppliedCustomerQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerByUserId, setCustomerByUserId] = useState<
    Record<string, string>
  >({});
  const customerByUserIdRef = useRef<Record<string, string>>({});
  customerByUserIdRef.current = customerByUserId;

  const apiStatus = view === "all" ? undefined : VIEW_STATUS[view];

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "order" ? "asc" : "desc");
  }

  const loadCounts = useCallback(() => {
    Promise.all([
      adminListOrders({ limit: 1 }),
      adminListOrders({ status: "pending", limit: 1 }),
      adminListOrders({ status: "paid", limit: 1 }),
      adminListOrders({ status: "delivered", limit: 1 }),
      adminListOrders({ status: "cancelled", limit: 1 }),
      adminListOrders({ status: "refunded", limit: 1 }),
      adminListOrders({ status: "failed", limit: 1 }),
    ])
      .then(([all, pending, paid, completed, cancelled, refunded, trash]) => {
        setCounts({
          all: all.total,
          pending: pending.total,
          paid: paid.total,
          completed: completed.total,
          cancelled: cancelled.total,
          refunded: refunded.total,
          trash: trash.total,
        });
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminListOrders({
      status: apiStatus,
      q: appliedCustomerQ.trim() || undefined,
      page,
      limit: ORDERS_PAGE_SIZE,
    })
      .then((r) => {
        setOrders(r.items);
        setListTotal(r.total);
      })
      .catch(() => {
        setOrders([]);
        setListTotal(0);
      })
      .finally(() => setLoading(false));
  }, [apiStatus, appliedCustomerQ, page]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const missing = [...new Set(orders.map((o) => o.userId))].filter(
      (id) => !customerByUserIdRef.current[id],
    );
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        adminGetCustomer(id)
          .then(
            (c) =>
              [id, getCustomerDisplayName(c)] as const,
          )
          .catch(() => [id, ""] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setCustomerByUserId((prev) => {
        const next = { ...prev };
        for (const [id, name] of pairs) {
          if (name) next[id] = name;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [orders]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkAction("");
  }, [view, appliedDate, appliedChannel, appliedCustomerQ, page]);

  useEffect(() => {
    getOrderLocks()
      .then((locks) => {
        const map: Record<string, OrderLockInfo> = {};
        for (const lock of locks) map[lock.orderId] = lock;
        setLockedOrders(map);
      })
      .catch(() => {});
  }, []);

  // Real-time lock updates via Socket.IO
  useOnStoreEvent("order.locked", (payload) => {
    setLockedOrders((prev) => ({
      ...prev,
      [payload.orderId]: {
        orderId: payload.orderId,
        userId: payload.userId,
        userName: payload.userName,
        lockedAt: new Date().toISOString(),
      },
    }));
  });

  useOnStoreEvent("order.unlocked", (payload) => {
    setLockedOrders((prev) => {
      const next = { ...prev };
      delete next[payload.orderId];
      return next;
    });
  });

  const visibleOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (!matchesDateRange(o.createdAt, appliedDate)) return false;
        if (appliedChannel !== "all" && o.payment.method !== appliedChannel) {
          return false;
        }
        return true;
      }),
    [orders, appliedDate, appliedChannel],
  );

  const searchActive = Boolean(appliedCustomerQ.trim());
  const clientFiltersActive =
    appliedDate !== "all" || appliedChannel !== "all";

  const totalPages = Math.max(1, Math.ceil(listTotal / ORDERS_PAGE_SIZE));
  const pageStart =
    listTotal === 0 ? 0 : (page - 1) * ORDERS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * ORDERS_PAGE_SIZE, listTotal);

  const sortedOrders = useMemo(() => {
    const list = [...visibleOrders];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "order") {
        cmp = a.orderNumber.localeCompare(b.orderNumber);
      } else if (sortKey === "date") {
        cmp =
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime();
      } else {
        cmp = a.pricing.total - b.pricing.total;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [visibleOrders, sortKey, sortDir]);

  // Server search uses listTotal; only date/channel filters narrow the current page client-side.
  const displayedOrderCount = clientFiltersActive
    ? sortedOrders.length
    : listTotal;

  const allVisibleSelected =
    sortedOrders.length > 0 &&
    sortedOrders.every((o) => selectedIds.has(o._id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sortedOrders.map((o) => o._id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applySearch() {
    setPage(1);
    setAppliedCustomerQ(draftCustomerQ);
  }

  function applyClientFilters() {
    setPage(1);
    setAppliedDate(draftDate);
    setAppliedChannel(draftChannel);
  }

  function clearSearch() {
    setDraftCustomerQ("");
    setAppliedCustomerQ("");
    setPage(1);
  }

  function clearClientFilters() {
    setDraftDate("all");
    setDraftChannel("all");
    setAppliedDate("all");
    setAppliedChannel("all");
    setPage(1);
  }

  function selectView(nextView: OrderView) {
    setPage(1);
    setView(nextView);
  }

  async function completeDeliver(ids: string[]) {
    setBusy(true);
    hideAdminToast();
    let ok = 0;
    let fail = 0;
    try {
      for (const id of ids) {
        try {
          await updateOrderStatus(id, "delivered");
          ok++;
        } catch {
          fail++;
        }
      }
      adminToast(
        fail > 0
          ? `Completed ${ok} order${ok === 1 ? "" : "s"}, ${fail} failed.`
          : `Order${ids.length === 1 ? "" : "s"} marked complete.`,
        true,
      );
      setSelectedIds(new Set());
      setBulkAction("");
      load();
      loadCounts();
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    const ids = [...selectedIds];

    if (bulkAction === "delivered") {
      void completeDeliver(ids);
      return;
    }

    if (bulkAction === "refund") {
      const count = ids.length;
      if (
        !window.confirm(
          `Refund ${count} order${count === 1 ? "" : "s"}? This will process refunds and cannot be undone.`,
        )
      ) {
        return;
      }
    }

    if (bulkAction === "failed") {
      const count = ids.length;
      if (
        !window.confirm(
          `Move ${count} order${count === 1 ? "" : "s"} to trash?`,
        )
      ) {
        return;
      }
    }

    if (bulkAction === "delete") {
      const count = ids.length;
      if (
        !window.confirm(
          `Permanently delete ${count} order${count === 1 ? "" : "s"}? This cannot be undone.`,
        )
      ) {
        return;
      }
    }

    if (bulkAction === "restore") {
      const count = ids.length;
      if (
        !window.confirm(
          `Restore ${count} order${count === 1 ? "" : "s"} from trash? Stock will be re-reserved where possible.`,
        )
      ) {
        return;
      }
    }

    setBusy(true);
    hideAdminToast();
    let ok = 0;
    const errors: string[] = [];

    try {
      for (const id of ids) {
        try {
          if (bulkAction === "refund") {
            await refundOrder(id);
          } else if (bulkAction === "delete") {
            await adminDeleteOrder(id);
          } else if (bulkAction === "restore") {
            await restoreOrder(id);
          } else {
            await updateOrderStatus(id, bulkAction as OrderStatusValue);
          }
          ok++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(msg);
          console.error("[bulk-action] order", id, "failed:", err);
        }
      }

      if (errors.length > 0 && ok === 0) {
        adminToast(
          `Action failed: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`,
          false,
        );
      } else if (errors.length > 0) {
        adminToast(
          `${ok} succeeded, ${errors.length} failed. Error: ${errors[0]}`,
          false,
        );
      } else {
        adminToast(
          `Bulk action applied to ${ok} order${ok === 1 ? "" : "s"}.`,
          true,
        );
      }

      if (ok > 0) {
        setSelectedIds(new Set());
        setBulkAction("");
        load();
        loadCounts();
      }
    } finally {
      setBusy(false);
    }
  }

  const orderStatusTabs = (
    <div
      className="admin-order-status-tabs-bar admin-order-status-tabs-bar--slider"
      role="tablist"
      aria-label="Order views"
    >
      {[
        { label: "All", value: counts.all, view: "all" as OrderView },
        {
          label: "Pending",
          value: counts.pending,
          view: "pending" as OrderView,
        },
        { label: "Paid", value: counts.paid, view: "paid" as OrderView },
        {
          label: "Completed",
          value: counts.completed,
          view: "completed" as OrderView,
        },
        {
          label: "Cancelled",
          value: counts.cancelled,
          view: "cancelled" as OrderView,
        },
        {
          label: "Refunded",
          value: counts.refunded,
          view: "refunded" as OrderView,
        },
        { label: "Trash", value: counts.trash, view: "trash" as OrderView },
      ].map((item, i) => (
        <span key={item.label} className="admin-order-status-tabs-item">
          {i > 0 && (
            <span className="mx-1.5 text-border-strong sm:mx-2" aria-hidden>
              |
            </span>
          )}
          {item.view ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === item.view}
              onClick={() => selectView(item.view as OrderView)}
              className={`admin-order-status-tab-btn ${
                view === item.view ? "admin-order-status-tab-btn--active" : ""
              }`}
            >
              <span className="admin-order-status-tab-label">{item.label}</span>
              <span
                className={`admin-order-status-tab-count ${
                  view === item.view
                    ? "admin-order-status-tab-count--active"
                    : ""
                }`}
              >
                {item.value.toLocaleString()}
              </span>
            </button>
          ) : (
            <span className="admin-order-status-tab-btn admin-order-status-tab-btn--plain">
              <span className="admin-order-status-tab-label">{item.label}</span>
              <span className="admin-order-status-tab-count">
                {item.value.toLocaleString()}
              </span>
            </span>
          )}
        </span>
      ))}
    </div>
  );

  
  return (
    <AdminPageLayout hideHeader>
      <div className="w-full min-w-0 space-y-4">
        <div className="flex w-full flex-row items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-2 py-3 sm:gap-x-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="dashboard-pro-section-icon shrink-0" aria-hidden>
              <CartIcon className="h-4 w-4" />
            </span>
            <h2 className="truncate text-sm font-semibold text-foreground">Orders</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/admin"
              className="dashboard-pro-btn-ghost shrink-0 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
            >
              ← Dashboard
            </Link>
            <button
              type="button"
              onClick={() =>
                adminToast("Manual order creation will be available soon.", true)
              }
              className="panel-3d-btn shrink-0 px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
            >
              Add order
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">

          {/* ── Filters row (hidden on mobile) ── */}
          <div className="admin-orders-filters-row flex w-full flex-col gap-3 max-sm:hidden rounded-xl border border-border/60 bg-muted/30 px-2 py-2 sm:px-4 sm:py-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-3 lg:gap-y-3">
            <div
              className={`flex min-w-0 flex-col justify-center lg:min-w-[9rem] lg:shrink-0${
                !loading && !clientFiltersActive ? " max-sm:hidden" : ""
              }`}
            >
              <h2 className="hidden text-sm font-semibold text-foreground sm:block">
                Order filters
              </h2>
              <p
                className={`mt-0.5 text-xs text-subtle${
                  !loading && !clientFiltersActive ? " hidden sm:block" : ""
                }`}
              >
                {loading
                  ? "Loading orders…"
                  : clientFiltersActive
                    ? `${displayedOrderCount} order${displayedOrderCount === 1 ? "" : "s"} on this page match filters`
                    : "Date range and payment channel"}
              </p>
              {clientFiltersActive ? (
                <span className="panel-3d-badge-amber mt-1.5 inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Filters active
                </span>
              ) : null}
            </div>

            <div className="admin-orders-filters-controls flex min-w-0 flex-row flex-nowrap items-center gap-2 max-sm:overflow-x-auto sm:flex-1 sm:flex-col sm:gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-3">
              <div className="admin-orders-filters-fields flex min-w-0 max-sm:flex-1 max-sm:flex-row max-sm:flex-nowrap max-sm:items-center max-sm:gap-2 max-sm:overflow-x-auto sm:grid sm:grid-cols-2 sm:gap-3 sm:flex-1 lg:min-w-0 lg:flex-1">
                <div className="min-w-0 max-sm:min-w-[4.5rem] max-sm:flex-1">
                  <AdminSelect
                    id="order-date"
                    value={draftDate}
                    onChange={(v) => setDraftDate(v as DateRange)}
                    className="w-full min-w-0"
                    options={DATE_OPTIONS.map((opt) => ({
                      value: opt.id,
                      label: opt.label,
                    }))}
                  />
                </div>

                <div className="min-w-0 max-sm:min-w-[4.5rem] max-sm:flex-1">
                  <AdminSelect
                    id="order-channel"
                    value={draftChannel}
                    onChange={(v) =>
                      setDraftChannel(v as PaymentMethodValue | "all")
                    }
                    className="w-full min-w-0"
                    options={CHANNEL_OPTIONS.map((opt) => ({
                      value: opt.id,
                      label: opt.label,
                    }))}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-row gap-2 max-sm:items-center sm:w-auto">
                <button
                  type="button"
                  onClick={applyClientFilters}
                  className="panel-3d-btn shrink-0 px-2 py-2 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  Apply
                </button>
                {clientFiltersActive ? (
                  <button
                    type="button"
                    onClick={clearClientFilters}
                    className="dashboard-pro-btn-ghost max-sm:hidden shrink-0 px-4 py-2 text-sm sm:w-auto"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Search + bulk action row ── */}
          <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-3 sm:px-4">
            <div className="admin-orders-search-bulk-row flex min-w-0 w-full flex-row flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto sm:gap-2 lg:flex-nowrap lg:gap-x-3">
              <label htmlFor="order-customer" className="sr-only">
                Search
              </label>
              <input
                id="order-customer"
                value={draftCustomerQ}
                onChange={(e) => setDraftCustomerQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Order, mobile, email, TrxID, gift card code"
                className="admin-input admin-orders-search-input min-w-0 flex-1 max-sm:min-w-[3.25rem] sm:flex-1"
              />
              <button
                type="button"
                onClick={applySearch}
                className="panel-3d-btn admin-orders-search-btn shrink-0 text-xs"
              >
                Search
              </button>
              {searchActive ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-sm max-sm:hidden sm:px-4"
                >
                  Clear
                </button>
              ) : null}

              <div
                className="hidden shrink-0 self-stretch w-px bg-border/50 lg:block"
                aria-hidden
              />

              <div className="min-w-0 flex-1 max-sm:min-w-[4.5rem] sm:min-w-[10rem] sm:flex-none lg:flex-1 lg:max-w-none">
                <AdminSelect
                  id="bulk-actions"
                  value={bulkAction}
                  onChange={(v) => setBulkAction(v as BulkAction)}
                  className="admin-orders-bulk-select w-full min-w-0"
                  options={[
                    { value: "", label: "Bulk Action" },
                    ...(view !== "trash" ? [
                      { value: "processing", label: "Mark processing" },
                      { value: "delivered", label: "Mark completed" },
                      { value: "cancelled", label: "Mark cancelled" },
                      { value: "failed", label: "Move to trash" },
                      { value: "refund", label: "Refund" },
                    ] : [
                      { value: "restore", label: "Restore orders" },
                      { value: "delete", label: "Delete permanently" },
                    ]),
                  ]}
                />
              </div>
              <button
                type="button"
                disabled={busy || !bulkAction || selectedIds.size === 0}
                onClick={applyBulkAction}
                className="panel-3d-btn admin-orders-apply-btn shrink-0 text-xs disabled:opacity-40"
              >
                Apply
              </button>
              {selectedIds.size > 0 ? (
                <span className="text-xs text-foreground-muted max-sm:hidden lg:ml-auto">
                  {selectedIds.size} order{selectedIds.size === 1 ? "" : "s"} selected
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel-3d-table-wrap admin-orders-table-wrap admin-orders-table-shell w-full min-w-0 overflow-hidden">
          <div className="admin-orders-status-tabs-outer">{orderStatusTabs}</div>
          <div className="admin-orders-table-scroll w-full min-w-0 overflow-x-auto max-md:overflow-x-visible">
          <table className="panel-3d-table panel-3d-table--orders">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all orders"
                    className="rounded border-border-strong"
                    disabled={loading || sortedOrders.length === 0}
                  />
                </th>
                <SortableTh
                  label="Order"
                  sortKey="order"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Date"
                  sortKey="date"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th>Status</th>
                <SortableTh
                  label="Total"
                  sortKey="total"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <th>Origin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="admin-orders-table-empty-cell">
                    <p className="text-sm text-subtle">Loading…</p>
                  </td>
                </tr>
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-orders-table-empty-cell">
                    <p className="text-sm text-subtle">No orders found.</p>
                  </td>
                </tr>
              ) : (
                sortedOrders.map((o) => {
                const customer = resolveOrderCustomerLabel(
                  o,
                  customerByUserId[o.userId],
                );
                const isRefunded = o.status === "refunded";
                const refundAmount = o.refund?.amount ?? 0;

                const activeLock = lockedOrders[o._id];
                return (
                  <tr key={o._id} className={activeLock ? "opacity-80" : undefined}>
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o._id)}
                        onChange={() => toggleSelect(o._id)}
                        aria-label={`Select ${o.orderNumber}`}
                        className="rounded border-border-strong"
                      />
                    </td>
                    <td data-label="Order">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link
                          href={`/admin/sales/orders/${o._id}`}
                          className="admin-order-link break-all font-mono"
                        >
                          {formatAdminOrderRef(o.orderNumber)}
                        </Link>
                        {activeLock && (
                          <span
                            title={`Locked by ${activeLock.userName}`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300"
                          >
                            <svg viewBox="0 0 12 14" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
                              <rect x="1" y="6" width="10" height="8" rx="1.5" />
                              <path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                            </svg>
                            {activeLock.userName}
                          </span>
                        )}
                        <span className="max-w-full truncate text-xs text-foreground-muted">
                          {customer}
                        </span>
                      </div>
                    </td>
                    <td data-label="Date">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/admin/sales/orders/${o._id}`}
                          className="admin-order-view-btn"
                          aria-label={`View order ${o.orderNumber}`}
                        >
                          <OrderViewIcon />
                        </Link>
                        <span className="text-foreground-muted">
                          {formatOrderWhen(o.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          ADMIN_ORDER_STATUS_STYLE[o.status] ??
                          "admin-order-badge-muted"
                        }
                      >
                        {ADMIN_ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td data-label="Total" className="text-right font-semibold text-foreground">
                      {isRefunded ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <span className="font-normal text-subtle line-through">
                            <PriceText amount={o.pricing.total} currency={o.pricing.currency} />
                          </span>
                          <span>
                            <PriceText amount={refundAmount} currency={o.pricing.currency} />
                          </span>
                        </span>
                      ) : (
                        <PriceText amount={o.pricing.total} currency={o.pricing.currency} />
                      )}
                    </td>
                    <td data-label="Origin" className="text-foreground-muted">
                      {adminOrderOrigin(o.payment.method)}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        {!loading && listTotal > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3">
            <p className="text-xs text-foreground-muted">
              Showing {pageStart}–{pageEnd} of {listTotal.toLocaleString()}{" "}
              order{listTotal === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || busy}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-foreground-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || busy}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
