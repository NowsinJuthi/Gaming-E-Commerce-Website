"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  KeyIcon,
  PulseIcon,
  ReceiptIcon,
  StoreIcon,
  TagIcon,
} from "@/components/admin/icons";
import {
  adminListProducts,
  adminListResellerApiKeys,
  adminListResellerPrices,
  adminListResellers,
  adminListWholesaleOrders,
  adminRemoveResellerPrice,
  adminSetResellerPrice,
  adminTopUpReseller,
  adminUpdateReseller,
  formatPrice,
  getResellerAdminOverview,
  type AdminProduct,
  type AdminResellerRow,
  type ResellerAdminOverview,
  type ResellerApiKey,
  type ResellerOrder,
  type ResellerPrice,
  type ResellerStatus,
  type ResellerTier,
} from "@/lib/api";

type Tab = "resellers" | "orders";
type ConfigTab = "general" | "pricing" | "balance" | "api";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "resellers", label: "Resellers" },
  { id: "orders", label: "Wholesale orders" },
];

const CONFIG_TABS: Array<{ id: ConfigTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "pricing", label: "Pricing" },
  { id: "balance", label: "Balance" },
  { id: "api", label: "API keys" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  active: "dashboard-pro-status dashboard-pro-status--green",
  suspended: "dashboard-pro-status dashboard-pro-status--brand",
  completed: "dashboard-pro-status dashboard-pro-status--green",
  cancelled: "dashboard-pro-status",
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function overviewStatClass(
  tone: "brand" | "success" | "amber" | "muted",
  active?: boolean,
) {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "w-full text-left",
    active ? "customer-dashboard-overview-stat--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function ResellerOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: ReactNode;
}) {
  return (
    <div className="customer-dashboard-overview-stat-copy min-w-0">
      <span className="customer-dashboard-overview-stat-label">{label}</span>
      <span className="customer-dashboard-overview-stat-value">{value}</span>
      <p className="customer-dashboard-overview-stat-meta">{meta}</p>
    </div>
  );
}

function configTabClass(active: boolean) {
  const base = "rounded-md px-3 py-1.5 text-xs font-semibold";
  return active
    ? `${base} dashboard-pro-status dashboard-pro-status--green`
    : `${base} border border-border/50 bg-muted/30 text-foreground-muted`;
}

export default function AdminResellersPage() {
  const [tab, setTab] = useState<Tab>("resellers");
  const [overview, setOverview] = useState<ResellerAdminOverview | null>(null);
  const [resellers, setResellers] = useState<AdminResellerRow[]>([]);
  const [orders, setOrders] = useState<ResellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ResellerStatus | "">("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminResellerRow | null>(null);
  const [configTab, setConfigTab] = useState<ConfigTab>("general");
  const [editTier, setEditTier] = useState<ResellerTier>("standard");
  const [editStatus, setEditStatus] = useState<ResellerStatus>("active");
  const [editDiscount, setEditDiscount] = useState("10");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [prices, setPrices] = useState<ResellerPrice[]>([]);
  const [apiKeys, setApiKeys] = useState<ResellerApiKey[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [priceProductId, setPriceProductId] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ResellerOrder | null>(null);
  const [busy, setBusy] = useState(false);
    const resellerRequestRef = useRef(0);
  const ordersLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getResellerAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    adminListProducts({ status: "active" })
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "resellers") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminListResellers({
        status: status || undefined,
        q: q || undefined,
        limit: 50,
      })
        .then((r) => {
          if (!cancelled) setResellers(r.items);
        })
        .catch(() => {
          if (!cancelled) setResellers([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, status, q]);

  useEffect(() => {
    if (tab !== "orders") return;
    if (ordersLoadedRef.current) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminListWholesaleOrders({ limit: 50 })
      .then((r) => {
        if (!cancelled) {
          setOrders(r.items);
          ordersLoadedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  function reloadOverview() {
    getResellerAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }

  function closeResellerPanel() {
    resellerRequestRef.current += 1;
    setSelected(null);
  }

  async function openReseller(row: AdminResellerRow) {
    if (busy) return;
    const requestId = ++resellerRequestRef.current;
    setSelected(row);
    setConfigTab("general");
    setEditTier(row.tier);
    setEditStatus(row.status);
    setEditDiscount(String(Math.round(row.discountRate * 100)));
    setTopupAmount("");
    setTopupNote("");
    setPrices([]);
    setApiKeys([]);
    try {
      const [p, k] = await Promise.all([
        adminListResellerPrices(row._id).catch(() => []),
        adminListResellerApiKeys(row._id).catch(() => []),
      ]);
      if (resellerRequestRef.current !== requestId) return;
      setPrices(p);
      setApiKeys(k);
    } catch {
      /* ignore */
    }
  }

  async function saveGeneral() {
    if (!selected) return;
    const discountRate = Number(editDiscount) / 100;
    if (Number.isNaN(discountRate) || discountRate < 0 || discountRate > 1) {
      adminToast("Discount must be 0–100%.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      await adminUpdateReseller(selected._id, {
        status: editStatus,
        tier: editTier,
        discountRate,
      });
      setResellers((current) =>
        current.map((row) =>
          row._id === selected._id
            ? {
                ...row,
                status: editStatus,
                tier: editTier,
                discountRate,
              }
            : row,
        ),
      );
      adminToast("Reseller updated.", true);
      reloadOverview();
      closeResellerPanel();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function doTopUp() {
    if (!selected) return;
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      adminToast("Enter a valid top-up amount.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      await adminTopUpReseller(selected._id, amount, topupNote || undefined);
      const nextBalance = selected.balance + amount;
      setSelected((current) =>
        current ? { ...current, balance: nextBalance } : current,
      );
      setResellers((current) =>
        current.map((row) =>
          row._id === selected._id ? { ...row, balance: nextBalance } : row,
        ),
      );
      setTopupAmount("");
      adminToast(`Topped up ${formatPrice(amount, selected.currency)}.`, true);
      reloadOverview();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Top-up failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function addPrice() {
    if (!selected || !priceProductId || !priceValue) return;
    const unitPrice = Number(priceValue);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      adminToast("Enter a valid price.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      const saved = await adminSetResellerPrice(selected._id, {
        productId: priceProductId,
        unitPrice,
      });
      setPrices((current) => {
        const next = current.filter(
          (row) => String(row.productId) !== String(saved.productId),
        );
        return [...next, saved];
      });
      setPriceProductId("");
      setPriceValue("");
      adminToast("Custom price saved.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function removePrice(productId: string) {
    if (!selected) return;
    setBusy(true);
    hideAdminToast();
    try {
      await adminRemoveResellerPrice(selected._id, productId);
      setPrices((current) =>
        current.filter((row) => String(row.productId) !== productId),
      );
      adminToast("Price removed.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Remove failed", false);
    } finally {
      setBusy(false);
    }
  }

  const productsById = useMemo(() => {
    const map = new Map<string, AdminProduct>();
    for (const product of products) {
      map.set(product._id, product);
    }
    return map;
  }, [products]);

  const filtersActive = Boolean(q || status);
  const listCount = tab === "resellers" ? resellers.length : orders.length;

  return (
    <AdminPageLayout
      section="Customers"
      title="Resellers"
      description="Manage wholesale partners — custom pricing, wallet balance, API keys, and wholesale orders."
      icon={StoreIcon}
      backHref="/admin/customers"
      backLabel="All customers"
    >

      <AdminOrderListCard
        icon={<StoreIcon className="h-4 w-4" />}
        title={tab === "resellers" ? "Reseller list" : "Wholesale orders"}
        subtitle={
          loading
            ? "Loading…"
            : `${listCount.toLocaleString()} ${tab === "resellers" ? "reseller" : "order"}${listCount === 1 ? "" : "s"} shown`
        }
        className="admin-resellers-catalog"
      >
            {overview ? (
              <section
                className="customer-dashboard-overview-section admin-resellers-overview"
                aria-label="Reseller overview"
              >
                <div className="customer-dashboard-overview-stats">
                  <div
                    className={`${overviewStatClass("brand")} cursor-default`}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <StoreIcon className="h-4 w-4" />
                    </span>
                    <ResellerOverviewStatCopy
                      label="Total resellers"
                      value={overview.resellers.total.toLocaleString()}
                      meta="Registered partners"
                    />
                  </div>

                  <button
                    type="button"
                    aria-pressed={status === "pending" && tab === "resellers"}
                    onClick={() => {
                      setTab("resellers");
                      setStatus(status === "pending" ? "" : "pending");
                    }}
                    className={overviewStatClass(
                      "amber",
                      status === "pending" && tab === "resellers",
                    )}
                  >
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
                    <ResellerOverviewStatCopy
                      label="Pending"
                      value={overview.resellers.pending.toLocaleString()}
                      meta="Awaiting approval"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={status === "active" && tab === "resellers"}
                    onClick={() => {
                      setTab("resellers");
                      setStatus(status === "active" ? "" : "active");
                    }}
                    className={overviewStatClass(
                      "success",
                      status === "active" && tab === "resellers",
                    )}
                  >
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
                    <ResellerOverviewStatCopy
                      label="Active"
                      value={overview.resellers.active.toLocaleString()}
                      meta="Approved & trading"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={tab === "orders"}
                    onClick={() => setTab("orders")}
                    className={overviewStatClass("amber", tab === "orders")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <ReceiptIcon className="h-4 w-4" />
                    </span>
                    <ResellerOverviewStatCopy
                      label="Wholesale orders"
                      value={overview.wholesale.orders.toLocaleString()}
                      meta={
                        <>
                          <PriceText
                            amount={overview.wholesale.spent}
                            currency="BDT"
                          />{" "}
                          spent
                        </>
                      }
                    />
                  </button>

                  <div
                    className={`${overviewStatClass("muted")} cursor-default`}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <KeyIcon className="h-4 w-4" />
                    </span>
                    <ResellerOverviewStatCopy
                      label="API keys"
                      value={overview.apiKeys.active.toLocaleString()}
                      meta="Active integrations"
                    />
                  </div>

                  <div
                    className={`${overviewStatClass("muted")} cursor-default`}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <TagIcon className="h-4 w-4" />
                    </span>
                    <ResellerOverviewStatCopy
                      label="Default discount"
                      value={`${Math.round(overview.defaultDiscountRate * 100)}%`}
                      meta={overview.tiers.join(", ")}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <div className="admin-products-filters-list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {tab === "resellers" && filtersActive ? (
                  <>
                    <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex">
                      Filters active
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        setStatus("");
                      }}
                      className="dashboard-pro-btn-ghost shrink-0 text-xs"
                    >
                      Clear filters
                    </button>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-strong/40 pb-4 text-sm">
                {TABS.map((item, index) => {
                  const active = tab === item.id;
                  const count =
                    item.id === "resellers"
                      ? (overview?.resellers.total ?? resellers.length)
                      : (overview?.wholesale.orders ?? orders.length);
                  return (
                    <span key={item.id} className="inline-flex items-center gap-2">
                      {index > 0 ? (
                        <span className="text-subtle" aria-hidden>
                          |
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`admin-resellers-tab ${
                          active
                            ? "font-semibold text-foreground"
                            : "text-brand hover:underline"
                        }`}
                      >
                        {item.label} ({count.toLocaleString()})
                      </button>
                    </span>
                  );
                })}
              </div>

              {tab === "resellers" ? (
                <div className="admin-products-filters-row">
                  <div className="admin-products-filter-field min-w-0 col-span-2 sm:col-span-1">
                    <label
                      htmlFor="reseller-search"
                      className="admin-products-filter-label"
                    >
                      Search
                    </label>
                    <input
                      id="reseller-search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search company…"
                      className={inputCls}
                    />
                  </div>
                  <div className="admin-products-filter-field min-w-0">
                    <label
                      htmlFor="reseller-status"
                      className="admin-products-filter-label"
                    >
                      Status
                    </label>
                    <AdminSelect
                      id="reseller-status"
                      value={status}
                      onChange={(v) => setStatus(v as ResellerStatus | "")}
                      className="w-full"
                      options={[
                        { value: "", label: "All statuses" },
                        { value: "pending", label: "Pending" },
                        { value: "active", label: "Active" },
                        { value: "suspended", label: "Suspended" },
                      ]}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="admin-products-table-empty">Loading…</div>
            ) : tab === "resellers" ? (
              resellers.length === 0 ? (
                <div className="dashboard-pro-empty px-4 py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <StoreIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No resellers found
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                    {filtersActive
                      ? "Try clearing filters or adjusting your search."
                      : "Resellers appear here once registered."}
                  </p>
                </div>
              ) : (
                <div className="admin-products-table-wrap admin-resellers-table-wrap overflow-x-auto">
                  <table className="admin-resellers-table w-full">
                  <thead className="admin-resellers-table-head">
                    <tr>
                      <th>Company</th>
                      <th>User</th>
                      <th>Balance</th>
                      <th>Tier</th>
                      <th>Orders</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellers.map((r) => (
                      <tr
                        key={r._id}
                        onClick={() => void openReseller(r)}
                        className="cursor-pointer"
                      >
                        <td className="font-semibold text-foreground">
                          {r.companyName}
                        </td>
                        <td className="text-xs">
                          {r.displayName ??
                            r.email ??
                            `…${r.userId.slice(-6)}`}
                        </td>
                        <td><PriceText amount={r.balance} currency={r.currency} /></td>
                        <td className="capitalize">{r.tier}</td>
                        <td>{r.totalOrders}</td>
                        <td>
                          <span
                            className={`capitalize ${
                              STATUS_STYLE[r.status] ?? "dashboard-pro-status"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )
            ) : orders.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <StoreIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No wholesale orders
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  Orders from reseller wallets will appear here.
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap admin-resellers-table-wrap overflow-x-auto">
                <table className="admin-resellers-table w-full">
                <thead className="admin-resellers-table-head">
                  <tr>
                    <th>Order</th>
                    <th>Total</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o._id}
                      onClick={() => setSelectedOrder(o)}
                      className="cursor-pointer"
                    >
                      <td className="font-mono text-xs font-semibold text-foreground">
                        {o.orderNumber}
                      </td>
                      <td><PriceText amount={o.total} currency={o.currency} /></td>
                      <td className="capitalize">{o.source}</td>
                      <td>
                        <span
                          className={`capitalize ${
                            STATUS_STYLE[o.status] ?? "dashboard-pro-status"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="text-foreground-muted">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
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
        <div className="admin-resellers-drawer fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close reseller panel"
            className="admin-resellers-drawer-backdrop flex-1 bg-black/50"
            onClick={closeResellerPanel}
          />
          <div className="admin-resellers-drawer-panel flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-elevated">
            <div className="shrink-0 border-b border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {selected.companyName}
                  </h2>
                  <p className="text-xs text-subtle">
                    {selected.email} · Balance{" "}
                    <PriceText amount={selected.balance} currency={selected.currency} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeResellerPanel}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONFIG_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setConfigTab(id)}
                    className={configTabClass(configTab === id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {configTab === "general" ? (
                <div className="space-y-3">
                  <Field label="Status">
                    <AdminSelect
                      value={editStatus}
                      onChange={(v) => setEditStatus(v as ResellerStatus)}
                      className="w-full"
                      options={[
                        { value: "pending", label: "Pending" },
                        { value: "active", label: "Active" },
                        { value: "suspended", label: "Suspended" },
                      ]}
                    />
                  </Field>
                  <Field label="Tier">
                    <AdminSelect
                      value={editTier}
                      onChange={(v) => setEditTier(v as ResellerTier)}
                      className="w-full"
                      options={[
                        { value: "standard", label: "Standard" },
                        { value: "silver", label: "Silver" },
                        { value: "gold", label: "Gold" },
                        { value: "platinum", label: "Platinum" },
                      ]}
                    />
                  </Field>
                  <Field label="Default discount (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={saveGeneral}
                    disabled={busy}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : null}

              {configTab === "pricing" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <AdminSelect
                      value={priceProductId}
                      onChange={setPriceProductId}
                      className="admin-input min-w-0 flex-1"
                      options={[
                        { value: "", label: "Select product…" },
                        ...products.map((p) => ({
                          value: p._id,
                          label: p.title,
                        })),
                      ]}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      placeholder="Price"
                      className="admin-input w-24"
                    />
                    <button
                      type="button"
                      onClick={addPrice}
                      disabled={busy}
                      className="btn-primary-sm disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {prices.length === 0 ? (
                    <p className="text-sm text-subtle">No custom prices.</p>
                  ) : (
                    <ul className="space-y-2">
                      {prices.map((p) => {
                        const prod = productsById.get(String(p.productId));
                        return (
                          <li
                            key={p._id}
                            className="admin-resellers-price-row flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm"
                          >
                            <span className="text-foreground-muted">
                              {prod?.title ??
                                `…${String(p.productId).slice(-6)}`}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                <PriceText amount={p.unitPrice} currency={p.currency} />
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  removePrice(String(p.productId))
                                }
                                className="dashboard-pro-btn-ghost text-xs text-rose-400"
                              >
                                Remove
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              {configTab === "balance" ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground-muted">
                    Current:{" "}
                    <strong className="text-foreground">
                      <PriceText amount={selected.balance} currency={selected.currency} />
                    </strong>
                  </p>
                  <Field label="Top-up amount">
                    <input
                      type="number"
                      min={1}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="Top-up amount"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Note (optional)">
                    <input
                      value={topupNote}
                      onChange={(e) => setTopupNote(e.target.value)}
                      placeholder="Note (optional)"
                      className={inputCls}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={doTopUp}
                    disabled={busy}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    Credit balance
                  </button>
                </div>
              ) : null}

              {configTab === "api" ? (
                <div className="space-y-2">
                  {apiKeys.length === 0 ? (
                    <p className="text-sm text-subtle">
                      No API keys. Reseller creates keys from their portal.
                    </p>
                  ) : (
                    apiKeys.map((k) => (
                      <div
                        key={k._id}
                        className="admin-resellers-api-key rounded-xl border border-border/50 px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-foreground">{k.label}</p>
                        <p className="font-mono text-xs text-subtle">
                          {k.prefix}…
                          {k.revokedAt ? " · revoked" : ""}
                          {k.lastUsedAt &&
                            ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="admin-resellers-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="dashboard-pro-card admin-resellers-order-modal max-h-[80vh] w-full max-w-md overflow-y-auto p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono font-bold text-foreground">
                {selectedOrder.orderNumber}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="dashboard-pro-btn-ghost text-xs"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm capitalize text-foreground-muted">
              {selectedOrder.status} · {selectedOrder.source}
            </p>
            <div className="mt-4 space-y-2">
              {selectedOrder.items.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  className="admin-resellers-order-item rounded-xl border border-border/50 p-3 text-sm text-foreground-muted"
                >
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p>
                    {item.quantity} ×{" "}
                    <PriceText amount={item.unitPrice} currency={selectedOrder.currency} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
