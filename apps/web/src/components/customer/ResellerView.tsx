"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PriceText } from "@/components/ui/PriceText";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  AdminOrderStatField,
  AdminOrderStatsGrid,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import {
  BoxIcon,
  GridIcon,
  KeyIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TagIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  ApiError,
  applyReseller,
  createResellerApiKey,
  createWholesaleOrder,
  formatPrice,
  getResellerBalance,
  getResellerCatalog,
  getResellerMe,
  getResellerPrices,
  getWalletTransactions,
  listResellerApiKeys,
  listWholesaleOrders,
  revokeResellerApiKey,
  type ResellerApiKey,
  type ResellerCatalogItem,
  type ResellerOrder,
  type ResellerPrice,
  type ResellerRecord,
  type Wallet,
} from "@/lib/api";
import { RESELLER_QUICK_LINKS } from "@/lib/customer-quick-links";

type Tab = "catalog" | "orders" | "balance" | "api" | "pricing";

const RESELLER_TABS: readonly { id: Tab; label: string }[] = [
  { id: "catalog", label: "Wholesale catalog" },
  { id: "orders", label: "Orders" },
  { id: "balance", label: "Balance" },
  { id: "api", label: "API access" },
  { id: "pricing", label: "Custom pricing" },
];

function formatTxnType(type: string) {
  return type.replace(/_/g, " ");
}

function ResellerHelpSidebar() {
  return (
    <>
      <ProductFormOrderCard
        icon={<StoreIcon className="h-4 w-4" />}
        title="Reseller guide"
        subtitle="Wholesale program overview"
        className="admin-product-form-section"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Wholesale pricing</dt>
          <dd className="text-sm text-foreground-muted">
            Buy at discounted wholesale rates based on your tier. Admin can set
            custom per-product prices.
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Wallet balance</dt>
          <dd className="text-sm text-foreground-muted">
            Orders debit your reseller balance automatically. Top-ups are added
            by admin after approval.
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>API access</dt>
          <dd className="text-sm text-foreground-muted">
            Active resellers can place orders programmatically with API keys.
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<SettingsIcon className="h-4 w-4" />}
        title="Need help?"
        subtitle="Reseller program support"
        className="admin-product-form-section"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Support</dt>
          <dd className="space-y-3 text-sm text-foreground-muted">
            <p>
              Questions about applications, wholesale orders, or API access?
              Contact support.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/chat" className="dashboard-pro-btn text-xs">
                Live chat
              </Link>
              <Link
                href="/support"
                className="dashboard-pro-btn-ghost text-xs"
              >
                Support center
              </Link>
            </div>
          </dd>
        </div>
      </ProductFormOrderCard>
    </>
  );
}

export function ResellerView() {
  const [reseller, setReseller] = useState<ResellerRecord | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [balance, setBalance] = useState<Wallet | null>(null);
  const [catalog, setCatalog] = useState<ResellerCatalogItem[]>([]);
  const [orders, setOrders] = useState<ResellerOrder[]>([]);
  const [prices, setPrices] = useState<ResellerPrice[]>([]);
  const [apiKeys, setApiKeys] = useState<ResellerApiKey[]>([]);
  const [transactions, setTransactions] = useState<
    Array<{
      _id: string;
      type: string;
      amount: number;
      currency: string;
      description?: string;
      createdAt?: string;
    }>
  >([]);
  const [tab, setTab] = useState<Tab>("catalog");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ResellerOrder | null>(
    null,
  );

  const loadActive = useCallback(async () => {
    const [me, bal, cat, ord, pr, keys, tx] = await Promise.all([
      getResellerMe(),
      getResellerBalance(),
      getResellerCatalog().catch(() => []),
      listWholesaleOrders(1, 50).then((r) => r.items),
      getResellerPrices().catch(() => []),
      listResellerApiKeys().catch(() => []),
      getWalletTransactions(1, 20).then((r) => r.items),
    ]);
    setReseller(me);
    setBalance(bal);
    setCatalog(cat);
    setOrders(ord);
    setPrices(pr);
    setApiKeys(keys);
    setTransactions(tx);
  }, []);

  useEffect(() => {
    getResellerMe()
      .then(async (me) => {
        setReseller(me);
        if (me.status === "active") {
          await loadActive();
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotRegistered(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [loadActive]);

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await applyReseller(companyName);
      setReseller(me);
      setNotRegistered(false);
      setToast({
        text: "Application submitted. Awaiting admin approval.",
        ok: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) return;
    setBusy(true);
    setToast(null);
    try {
      const order = await createWholesaleOrder(items);
      setToast({ text: `Order ${order.orderNumber} placed.`, ok: true });
      setCart({});
      await loadActive();
      setSelectedOrder(order);
      setTab("orders");
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Order failed",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    setBusy(true);
    try {
      const created = await createResellerApiKey(newKeyLabel.trim());
      setRawKey(created.key);
      setNewKeyLabel("");
      setApiKeys(await listResellerApiKeys());
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Could not create key",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeKey(id: string) {
    if (!confirm("Revoke this API key?")) return;
    try {
      await revokeResellerApiKey(id);
      setApiKeys(await listResellerApiKeys());
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Could not revoke key",
        ok: false,
      });
    }
  }

  const cartTotal = useMemo(
    () =>
      catalog.reduce((sum, p) => {
        const q = cart[p.productId] ?? 0;
        return sum + p.wholesalePrice * q;
      }, 0),
    [cart, catalog],
  );
  const cartCount = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart],
  );

  const discountPct = reseller ? Math.round(reseller.discountRate * 100) : 0;
  const isActive = reseller?.status === "active";

  const pageTitle = notRegistered
    ? "Become a reseller"
    : reseller?.status === "pending"
      ? "Application pending"
      : reseller?.status === "suspended"
        ? "Account suspended"
        : reseller?.companyName ?? "Reseller";

  const pageDescription = notRegistered
    ? "Wholesale pricing, API access, and wallet balance."
    : reseller?.status === "pending"
      ? `${reseller.companyName} — waiting for admin approval.`
      : reseller?.status === "suspended"
        ? "Contact support for assistance."
        : isActive && reseller
          ? `${reseller.tier} tier · ${discountPct}% default discount`
          : "Reseller program";

  const headerAction = useMemo(() => {
    if (loading) return null;
    if (notRegistered) return null;
    if (!reseller) return null;

    if (reseller.status === "pending") {
      return (
        <span className="dashboard-pro-status dashboard-pro-status--amber capitalize">
          Pending approval
        </span>
      );
    }
    if (reseller.status === "suspended") {
      return (
        <span className="dashboard-pro-status capitalize">Suspended</span>
      );
    }
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand capitalize">
          {reseller.tier}
        </span>
        <span className="dashboard-pro-status dashboard-pro-status--green">
          {discountPct}% discount
        </span>
        {balance ? (
          <span className="dashboard-pro-status">
            <PriceText amount={balance.balance} currency={balance.currency} />
          </span>
        ) : null}
      </div>
    );
  }, [balance, discountPct, loading, notRegistered, reseller]);

  function renderToast() {
    if (!toast) return null;
    return (
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          toast.ok
            ? "border-brand/30 bg-brand/10 text-brand"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
        }`}
      >
        {toast.text}
      </div>
    );
  }

  function renderCatalogTab() {
    return (
      <div className="space-y-4">
        {cartCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/8 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {cartCount} item(s) ·{" "}
              <PriceText
                amount={cartTotal}
                currency={balance?.currency ?? "BDT"}
              />
            </span>
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={busy}
              className="dashboard-pro-btn text-xs disabled:opacity-50"
            >
              {busy ? "Placing…" : "Place wholesale order"}
            </button>
          </div>
        ) : null}
        {catalog.length === 0 ? (
          <div className="dashboard-pro-empty py-8">
            <p className="text-sm font-medium text-foreground">
              No catalog items
            </p>
            <p className="mt-1 text-xs text-subtle">
              Wholesale products will appear here when available.
            </p>
          </div>
        ) : (
          <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
            <table className="panel-3d-table w-full text-sm">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Retail</th>
                  <th>Your price</th>
                  <th>Stock</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((p) => (
                  <tr key={p.productId} className="text-foreground-muted">
                    <td className="font-medium text-foreground">
                      {p.title}
                      {p.hasOverride ? (
                        <span className="ml-1 text-xs text-brand">custom</span>
                      ) : null}
                    </td>
                    <td>
                      <PriceText amount={p.basePrice} currency={p.currency} />
                    </td>
                    <td className="font-semibold text-brand">
                      <PriceText
                        amount={p.wholesalePrice}
                        currency={p.currency}
                      />
                    </td>
                    <td>
                      {p.available <= 100 ? p.available : "In stock"}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={p.available}
                        value={cart[p.productId] ?? 0}
                        onChange={(e) =>
                          setCart((c) => ({
                            ...c,
                            [p.productId]: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          }))
                        }
                        className="admin-input w-16 px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderOrdersTab() {
    if (orders.length === 0) {
      return (
        <div className="dashboard-pro-empty py-8">
          <p className="text-sm font-medium text-foreground">
            No wholesale orders yet
          </p>
          <p className="mt-1 text-xs text-subtle">
            Place an order from the wholesale catalog to get started.
          </p>
        </div>
      );
    }
    return (
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o._id}>
            <button
              type="button"
              onClick={() => setSelectedOrder(o)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-elevated/50 px-4 py-3 text-left transition hover:border-brand/35"
            >
              <div>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {o.orderNumber}
                </p>
                <p className="mt-0.5 text-xs capitalize text-subtle">
                  {o.status} · {o.source} · {o.items.length} items
                </p>
              </div>
              <p className="font-semibold text-foreground">
                <PriceText amount={o.total} currency={o.currency} />
              </p>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function renderBalanceTab() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground-muted">
          Top-ups are added by admin. Purchases debit automatically on wholesale
          orders.
        </p>
        {transactions.length === 0 ? (
          <div className="dashboard-pro-empty py-8">
            <p className="text-sm font-medium text-foreground">
              No transactions yet
            </p>
          </div>
        ) : (
          <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
            <table className="panel-3d-table w-full text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id} className="text-foreground-muted">
                    <td className="capitalize">{formatTxnType(t.type)}</td>
                    <td className="font-medium text-foreground">
                      <PriceText amount={t.amount} currency={t.currency} />
                    </td>
                    <td className="max-w-[200px] truncate text-subtle">
                      {t.description ?? "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderApiTab() {
    const apiBase =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/reseller/api`
        : "/api/reseller/api";

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-elevated/50 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Programmatic API</p>
          <p className="mt-1 text-foreground-muted">
            Base URL:{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">
              {apiBase}
            </code>
          </p>
          <p className="mt-1 text-foreground-muted">
            Header:{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">
              x-api-key: rsk_…
            </code>
          </p>
          <p className="mt-1 text-xs text-subtle">
            Endpoints: GET /me, /balance, /catalog · POST /orders · GET /orders
          </p>
        </div>
        {rawKey ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <p className="font-semibold">
              Copy your key now — it won&apos;t be shown again:
            </p>
            <code className="mt-2 block break-all rounded bg-sunken p-2 font-mono text-xs text-foreground">
              {rawKey}
            </code>
          </div>
        ) : null}
        <form
          onSubmit={(e) => void onCreateKey(e)}
          className="flex flex-wrap gap-2"
        >
          <input
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            placeholder="Key label (e.g. Production)"
            className="admin-input min-w-[200px] flex-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="dashboard-pro-btn text-xs disabled:opacity-50"
          >
            Create key
          </button>
        </form>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-subtle">No API keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {apiKeys.map((k) => (
              <li
                key={k._id}
                className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {k.label}
                  </p>
                  <p className="font-mono text-xs text-subtle">
                    {k.prefix}…
                    {k.revokedAt ? (
                      <span className="ml-2 text-rose-400">revoked</span>
                    ) : null}
                  </p>
                </div>
                {!k.revokedAt ? (
                  <button
                    type="button"
                    onClick={() => void onRevokeKey(k._id)}
                    className="dashboard-pro-btn-ghost text-xs text-rose-400"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function renderPricingTab() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground-muted">
          Admin-set custom prices override your tier discount. Products without
          overrides use <strong>{discountPct}%</strong> off retail.
        </p>
        {prices.length === 0 ? (
          <div className="dashboard-pro-empty py-8">
            <p className="text-sm font-medium text-foreground">
              No custom prices
            </p>
            <p className="mt-1 text-xs text-subtle">
              Your tier discount applies to all catalog products.
            </p>
          </div>
        ) : (
          <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
            <table className="panel-3d-table w-full text-sm">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Wholesale price</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p._id} className="text-foreground-muted">
                    <td className="font-mono text-xs">
                      …{String(p.productId).slice(-8)}
                    </td>
                    <td className="font-semibold text-foreground">
                      <PriceText amount={p.unitPrice} currency={p.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderTabContent() {
    switch (tab) {
      case "catalog":
        return renderCatalogTab();
      case "orders":
        return renderOrdersTab();
      case "balance":
        return renderBalanceTab();
      case "api":
        return renderApiTab();
      case "pricing":
        return renderPricingTab();
      default:
        return null;
    }
  }

  function activeTabMeta() {
    return RESELLER_TABS.find((t) => t.id === tab) ?? RESELLER_TABS[0];
  }

  function renderMainContent() {
    if (notRegistered) {
      return (
        <>
          <AdminOrderPageIntro
            icon={<StoreIcon className="h-4 w-4" />}
            title="Become a reseller"
            subtitle="Apply for wholesale pricing, API access, and reseller wallet balance"
            quickLinks={RESELLER_QUICK_LINKS}
            quickNavLabel="Account shortcuts"
          />
          <AdminOrderTwoColumnLayout
            main={
              <AdminOrderListCard
                icon={<StoreIcon className="h-4 w-4" />}
                title="Reseller application"
                subtitle="Submit your company name to apply for the wholesale program"
              >
                <div className="space-y-4">
                  {renderToast()}
                  <form onSubmit={(e) => void onApply(e)} className="space-y-4">
                    {error ? (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                        {error}
                      </div>
                    ) : null}
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Company name</dt>
                      <dd>
                        <input
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="admin-input w-full"
                        />
                      </dd>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="dashboard-pro-btn disabled:opacity-50"
                    >
                      {busy ? "Submitting…" : "Apply now"}
                    </button>
                  </form>
                </div>
              </AdminOrderListCard>
            }
            sidebar={<ResellerHelpSidebar />}
          />
        </>
      );
    }

    if (!reseller) {
      return (
        <>
          <AdminOrderPageIntro
            icon={<StoreIcon className="h-4 w-4" />}
            title="Reseller program"
            subtitle="Could not load reseller account"
            quickLinks={RESELLER_QUICK_LINKS}
            quickNavLabel="Account shortcuts"
          />
          <AdminOrderTwoColumnLayout
            main={
              <AdminOrderListCard
                icon={<StoreIcon className="h-4 w-4" />}
                title="Reseller program"
                subtitle="Wholesale pricing and API access"
              >
                <div className="dashboard-pro-empty py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <GridIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {error ?? "Could not load reseller account."}
                  </p>
                  <Link href="/chat" className="dashboard-pro-btn mt-4">
                    Contact support
                  </Link>
                </div>
              </AdminOrderListCard>
            }
            sidebar={<ResellerHelpSidebar />}
          />
        </>
      );
    }

    if (reseller.status === "pending") {
      return (
        <>
          <AdminOrderPageIntro
            icon={<StoreIcon className="h-4 w-4" />}
            title="Application pending"
            subtitle={`${reseller.companyName} — waiting for admin approval`}
            quickLinks={RESELLER_QUICK_LINKS}
            quickNavLabel="Account shortcuts"
          />
          <AdminOrderTwoColumnLayout
            main={
              <AdminOrderListCard
                icon={<StoreIcon className="h-4 w-4" />}
                title="Reseller application"
                subtitle="Your application is under review"
              >
                <div className="space-y-4">
                  {renderToast()}
                  <div className="dashboard-pro-empty py-8">
                    <span className="dashboard-pro-empty-icon" aria-hidden>
                      <GridIcon className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      Awaiting admin approval
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      We will notify you once your reseller application is
                      approved.
                    </p>
                  </div>
                </div>
              </AdminOrderListCard>
            }
            sidebar={<ResellerHelpSidebar />}
          />
        </>
      );
    }

    if (reseller.status === "suspended") {
      return (
        <>
          <AdminOrderPageIntro
            icon={<StoreIcon className="h-4 w-4" />}
            title="Account suspended"
            subtitle={`${reseller.companyName} — contact support for assistance`}
            quickLinks={RESELLER_QUICK_LINKS}
            quickNavLabel="Account shortcuts"
          />
          <AdminOrderTwoColumnLayout
            main={
              <AdminOrderListCard
                icon={<StoreIcon className="h-4 w-4" />}
                title="Reseller account"
                subtitle="Your reseller access is currently suspended"
              >
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  Your reseller account is suspended. Contact support for
                  assistance.
                </div>
              </AdminOrderListCard>
            }
            sidebar={<ResellerHelpSidebar />}
          />
        </>
      );
    }

    const tabMeta = activeTabMeta();
    if (!tabMeta) return null;

    return (
      <>
        <AdminOrderPageIntro
          icon={<StoreIcon className="h-4 w-4" />}
          title={reseller.companyName}
          subtitle={`${reseller.tier} tier · ${discountPct}% discount · ${orders.length} wholesale orders`}
          quickLinks={RESELLER_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />

        <AdminOrderTwoColumnLayout
          main={
            <>
              <AdminOrderListCard
                icon={<StoreIcon className="h-4 w-4" />}
                title="Reseller overview"
                subtitle={
                  balance
                    ? `${formatPrice(balance.balance, balance.currency)} balance · ${reseller.totalOrders} orders`
                    : "Wholesale program dashboard"
                }
              >
                <AdminOrderStatsGrid>
                  <AdminOrderStatField
                    icon={<WalletIcon className="h-4 w-4" />}
                    label="Balance"
                    value={
                      balance ? (
                        <PriceText
                          amount={balance.balance}
                          currency={balance.currency}
                        />
                      ) : (
                        "—"
                      )
                    }
                    meta="Reseller wallet"
                  />
                  <AdminOrderStatField
                    icon={<ReceiptIcon className="h-4 w-4" />}
                    label="Orders"
                    value={reseller.totalOrders.toLocaleString()}
                    meta="Wholesale orders"
                  />
                  <AdminOrderStatField
                    icon={<BoxIcon className="h-4 w-4" />}
                    label="Total spent"
                    value={formatPrice(reseller.totalSpent, "BDT")}
                    meta="Lifetime wholesale spend"
                  />
                  <AdminOrderStatField
                    icon={<TagIcon className="h-4 w-4" />}
                    label="Discount"
                    value={`${discountPct}%`}
                    meta={`${reseller.tier} tier`}
                  />
                </AdminOrderStatsGrid>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked border-t border-border/60 pt-4">
                  <dt>Sections</dt>
                  <dd>
                    <div className="admin-notifications-tabs" role="tablist">
                      {RESELLER_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          aria-selected={tab === t.id}
                          onClick={() => setTab(t.id)}
                          className={`admin-notifications-tab${
                            tab === t.id
                              ? " admin-notifications-tab--active"
                              : ""
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </dd>
                </div>

                <div className="flex flex-wrap justify-end gap-2.5">
                  <Link href="/wallet" className="dashboard-pro-btn-ghost text-xs">
                    Wallet
                  </Link>
                  <Link href="/orders" className="dashboard-pro-btn-ghost text-xs">
                    My orders
                  </Link>
                </div>
              </AdminOrderListCard>

              <AdminOrderListCard
                icon={
                  tab === "api" ? (
                    <KeyIcon className="h-4 w-4" />
                  ) : tab === "orders" ? (
                    <ReceiptIcon className="h-4 w-4" />
                  ) : tab === "balance" ? (
                    <WalletIcon className="h-4 w-4" />
                  ) : tab === "pricing" ? (
                    <TagIcon className="h-4 w-4" />
                  ) : (
                    <StoreIcon className="h-4 w-4" />
                  )
                }
                title={tabMeta.label}
                subtitle={
                  tab === "catalog"
                    ? `${catalog.length} products · ${cartCount} in cart`
                    : tab === "orders"
                      ? `${orders.length} wholesale orders`
                      : tab === "api"
                        ? `${apiKeys.length} API keys`
                        : tab === "pricing"
                          ? `${prices.length} custom prices`
                          : "Reseller account activity"
                }
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>{tabMeta.label}</dt>
                  <dd className="min-w-0 space-y-4">
                    {renderToast()}
                    {renderTabContent()}
                  </dd>
                </div>
              </AdminOrderListCard>
            </>
          }
          sidebar={<ResellerHelpSidebar />}
        />
      </>
    );
  }

  return (
    <CustomerPageLayout
      section="Account"
      title={pageTitle}
      description={pageDescription}
      iconKey="reseller"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading reseller portal…"
      action={headerAction}
    >
      {renderMainContent()}

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="admin-product-form-section max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/60 bg-elevated p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-lg font-bold text-foreground">
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
            <p className="mt-1 text-sm capitalize text-subtle">
              {selectedOrder.status} · {selectedOrder.source}
            </p>
            <div className="mt-4 space-y-3">
              {selectedOrder.items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 px-4 py-3"
                >
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-subtle">
                    {item.quantity} ×{" "}
                    <PriceText
                      amount={item.unitPrice}
                      currency={selectedOrder.currency}
                    />
                  </p>
                  {item.deliveredCodes && item.deliveredCodes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {item.deliveredCodes.map((d, j) => (
                        <code
                          key={j}
                          className="block rounded bg-sunken px-2 py-1 font-mono text-xs"
                        >
                          {d.code}
                        </code>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </CustomerPageLayout>
  );
}
