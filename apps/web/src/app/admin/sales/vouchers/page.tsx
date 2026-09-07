"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminVoucherCard } from "@/components/admin/AdminVoucherCard";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CheckIcon,
  GridIcon,
  PulseIcon,
  ReceiptIcon,
} from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import {
  createVoucher,
  deleteVoucher,
  listVouchers,
  type Voucher,
  type VoucherInput,
} from "@/lib/api";

type VoucherView = "all" | "active" | "redeemed" | "expired";

type Form = {
  code: string;
  amount: string;
  currency: string;
  assignedUserId: string;
  expiresAt: string;
};

const EMPTY: Form = {
  code: "",
  amount: "",
  currency: "BDT",
  assignedUserId: "",
  expiresAt: "",
};

const VIEW_TABS: Array<{ id: VoucherView; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "redeemed", label: "Redeemed" },
  { id: "expired", label: "Expired" },
];

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function isVoucherExpired(voucher: Voucher): boolean {
  if (!voucher.expiresAt) return false;
  return new Date(voucher.expiresAt).getTime() < Date.now();
}

function voucherDisplayStatus(
  voucher: Voucher,
): "active" | "redeemed" | "expired" {
  if (voucher.status === "redeemed") return "redeemed";
  if (voucher.status === "expired" || isVoucherExpired(voucher)) {
    return "expired";
  }
  return "active";
}

function matchesView(voucher: Voucher, view: VoucherView): boolean {
  if (view === "all") return true;
  return voucherDisplayStatus(voucher) === view;
}

function voucherViewLabel(view: VoucherView): string {
  return VIEW_TABS.find((tab) => tab.id === view)?.label ?? "All";
}

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

function countVoucherStats(vouchers: Voucher[]) {
  let active = 0;
  let redeemed = 0;
  let expired = 0;
  let activeValue = 0;
  let activeCurrency = "BDT";
  for (const voucher of vouchers) {
    const status = voucherDisplayStatus(voucher);
    if (status === "active") {
      active += 1;
      const currency = voucher.currency || "BDT";
      if (active === 1) {
        activeCurrency = currency;
        activeValue = voucher.amount;
      } else if (currency === activeCurrency) {
        activeValue += voucher.amount;
      }
    } else if (status === "redeemed") {
      redeemed += 1;
    } else {
      expired += 1;
    }
  }
  return {
    total: vouchers.length,
    active,
    redeemed,
    expired,
    activeValue,
    activeCurrency,
  };
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<VoucherView>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listVouchers()
      .then((items) => {
        if (!cancelled) setVouchers(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setVouchers([]);
          setLoadError(
            err instanceof Error ? err.message : "Failed to load vouchers",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => countVoucherStats(vouchers), [vouchers]);

  const filteredVouchers = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return vouchers
      .filter((voucher) => matchesView(voucher, view))
      .filter((voucher) => !q || voucher.code.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [appliedSearch, vouchers, view]);

  const filtersActive = appliedSearch.trim().length > 0;

  function setFormField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setAppliedSearch(draftSearch);
  }

  function clearFilters() {
    setDraftSearch("");
    setAppliedSearch("");
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    hideAdminToast();
    try {
      const payload: VoucherInput = {
        amount: Number(form.amount || 0),
        currency: form.currency || "BDT",
      };
      if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
      if (form.assignedUserId.trim()) {
        payload.assignedUserId = form.assignedUserId.trim();
      }
      if (form.expiresAt) {
        payload.expiresAt = new Date(form.expiresAt).toISOString();
      }
      const created = await createVoucher(payload);
      adminToast("Voucher created.", true);
      setForm(EMPTY);
      setVouchers((current) =>
        [...current, created].sort((a, b) => a.code.localeCompare(b.code)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, code: string) {
    if (!confirm(`Delete voucher "${code}"?`)) return;
    setDeletingId(id);
    hideAdminToast();
    setError(null);
    try {
      await deleteVoucher(id);
      adminToast("Voucher deleted.", true);
      setVouchers((current) =>
        current.filter((voucher) => voucher._id !== id),
      );
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminPageLayout
      section="Sales"
      title="Vouchers"
      description="Issue gift balance codes, track redemptions, and manage assigned store credit."
      icon={ReceiptIcon}
      backHref="/admin/sales/orders"
      backLabel="Orders"
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
        </div>
      ) : null}

      <div className="customer-dashboard-page dashboard-page--pro min-w-0 space-y-4">
            <section
              className="customer-dashboard-overview-section admin-vouchers-overview"
              aria-label="Voucher overview"
            >
              <div className="customer-dashboard-overview-stats">
                <button
                  type="button"
                  onClick={() => setView("all")}
                  className={overviewStatClass("brand", view === "all")}
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
                  <div className="customer-dashboard-overview-stat-copy min-w-0">
                    <span className="customer-dashboard-overview-stat-label">
                      Total vouchers
                    </span>
                    <span className="customer-dashboard-overview-stat-value">
                      {loading ? "…" : stats.total}
                    </span>
                    <p className="customer-dashboard-overview-stat-meta">
                      All gift codes
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setView("active")}
                  className={overviewStatClass("success", view === "active")}
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
                  <div className="customer-dashboard-overview-stat-copy min-w-0">
                    <span className="customer-dashboard-overview-stat-label">
                      Active
                    </span>
                    <span className="customer-dashboard-overview-stat-value">
                      {loading ? "…" : stats.active}
                    </span>
                    <p className="customer-dashboard-overview-stat-meta">
                      {loading
                        ? "Outstanding balance"
                        : (
                          <>
                            <PriceText
                              amount={stats.activeValue}
                              currency={stats.activeCurrency}
                            />{" "}
                            outstanding
                          </>
                        )}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setView("redeemed")}
                  className={overviewStatClass("muted", view === "redeemed")}
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
                  <div className="customer-dashboard-overview-stat-copy min-w-0">
                    <span className="customer-dashboard-overview-stat-label">
                      Redeemed
                    </span>
                    <span className="customer-dashboard-overview-stat-value">
                      {loading ? "…" : stats.redeemed}
                    </span>
                    <p className="customer-dashboard-overview-stat-meta">
                      Used by customers
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setView("expired")}
                  className={overviewStatClass("amber", view === "expired")}
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
                  <div className="customer-dashboard-overview-stat-copy min-w-0">
                    <span className="customer-dashboard-overview-stat-label">
                      Expired
                    </span>
                    <span className="customer-dashboard-overview-stat-value">
                      {loading ? "…" : stats.expired}
                    </span>
                    <p className="customer-dashboard-overview-stat-meta">
                      No longer redeemable
                    </p>
                  </div>
                </button>
              </div>
            </section>

            <section
              className="customer-dashboard-recent-orders-section"
              aria-labelledby="admin-vouchers-list-title"
            >
              <div className="admin-vouchers-toolbar mb-4 space-y-3 px-1">
                <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-3 sm:px-4">
                  <div
                    className="admin-email-logs-search-row flex min-w-0 w-full flex-row flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto sm:gap-2"
                  >
                    <label htmlFor="vouchers-search" className="sr-only">
                      Search voucher code
                    </label>
                    <input
                      id="vouchers-search"
                      type="search"
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyFilters();
                        }
                      }}
                      placeholder="Search code…"
                      className="admin-input admin-email-logs-search-input min-w-0 flex-1 max-sm:min-w-[3.25rem] sm:flex-1"
                    />
                    <button
                      type="button"
                      onClick={applyFilters}
                      className="panel-3d-btn admin-email-logs-search-btn shrink-0 text-xs"
                    >
                      Search
                    </button>
                    {filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-sm max-sm:hidden sm:px-4"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

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
                      <ReceiptIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="admin-vouchers-list-title"
                        className="customer-dashboard-mobile-page-title"
                      >
                        Voucher list
                      </h2>
                      <p className="customer-dashboard-mobile-welcome-sub">
                        {loading
                          ? "Loading vouchers…"
                          : filtersActive
                            ? `${filteredVouchers.length} voucher${filteredVouchers.length === 1 ? "" : "s"} matching search`
                            : `${filteredVouchers.length} voucher${filteredVouchers.length === 1 ? "" : "s"} in ${voucherViewLabel(view).toLowerCase()}`}
                      </p>
                    </div>
                  </div>
                </div>
              </header>

              {loading ? (
                <div className="dashboard-pro-empty py-10">
                  <p className="text-sm text-subtle">Loading vouchers…</p>
                </div>
              ) : filteredVouchers.length === 0 ? (
                <div className="dashboard-pro-empty py-10">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <GridIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    No vouchers found
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {vouchers.length === 0
                      ? "Create your first voucher using the form."
                      : "Try another filter or clear your search."}
                  </p>
                </div>
              ) : (
                <div className="customer-orders-list">
                  {filteredVouchers.map((voucher) => {
                    const status = voucherDisplayStatus(voucher);
                    return (
                      <AdminVoucherCard
                        key={voucher._id}
                        voucher={voucher}
                        status={status}
                        deleting={deletingId === voucher._id}
                        disabled={deletingId !== null}
                        onDelete={() => onDelete(voucher._id, voucher.code)}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-label="New voucher">
              <form onSubmit={onSave}>
                <ProductFormOrderCard
                  className="admin-product-form-section admin-vouchers-form"
                  icon={<ReceiptIcon className="h-4 w-4" />}
                  title="New voucher"
                  subtitle="Leave code blank to auto-generate."
                >
                  <div className="admin-product-form-sidebar-fields space-y-4">
                    <div>
                      <label htmlFor="voucher-code" className={labelCls}>
                        Code
                      </label>
                      <input
                        id="voucher-code"
                        value={form.code}
                        onChange={(e) => setFormField("code", e.target.value)}
                        placeholder="GIFT-500"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="voucher-amount" className={labelCls}>
                          Amount
                        </label>
                        <input
                          id="voucher-amount"
                          type="number"
                          step="0.01"
                          required
                          value={form.amount}
                          onChange={(e) =>
                            setFormField("amount", e.target.value)
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="voucher-currency" className={labelCls}>
                          Currency
                        </label>
                        <input
                          id="voucher-currency"
                          maxLength={3}
                          value={form.currency}
                          onChange={(e) =>
                            setFormField("currency", e.target.value.toUpperCase())
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="voucher-assigned-user" className={labelCls}>
                        Assigned user ID
                      </label>
                      <input
                        id="voucher-assigned-user"
                        value={form.assignedUserId}
                        onChange={(e) =>
                          setFormField("assignedUserId", e.target.value)
                        }
                        placeholder="Optional Mongo user id"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="voucher-expires-at" className={labelCls}>
                        Expires at
                      </label>
                      <input
                        id="voucher-expires-at"
                        type="date"
                        value={form.expiresAt}
                        onChange={(e) =>
                          setFormField("expiresAt", e.target.value)
                        }
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {saving ? "Creating…" : "Create voucher"}
                    </button>
                  </div>
                </ProductFormOrderCard>
              </form>
            </section>
          </div>
    </AdminPageLayout>
  );
}
