"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { CheckIcon, ChartIcon, TagIcon } from "@/components/admin/icons";
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  type Coupon,
  type CouponInput,
  type CouponType,
} from "@/lib/api";

type CouponView = "all" | "active" | "inactive" | "expired";

type Form = {
  code: string;
  type: CouponType;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  expiresAt: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
};

const EMPTY: Form = {
  code: "",
  type: "percent",
  value: "",
  minSubtotal: "",
  maxDiscount: "",
  expiresAt: "",
  usageLimit: "",
  perUserLimit: "",
  isActive: true,
};

const VIEW_TABS: Array<{ id: CouponView; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "expired", label: "Expired" },
];

const VIEW_LABEL: Record<CouponView, string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function isCouponExpired(coupon: Coupon): boolean {
  if (!coupon.expiresAt) return false;
  return new Date(coupon.expiresAt).getTime() < Date.now();
}

function matchesView(coupon: Coupon, view: CouponView): boolean {
  if (view === "all") return true;
  if (view === "active") return Boolean(coupon.isActive) && !isCouponExpired(coupon);
  if (view === "inactive") {
    return !coupon.isActive && !isCouponExpired(coupon);
  }
  return isCouponExpired(coupon);
}

function formatCouponValue(coupon: Coupon): string {
  return coupon.type === "percent" ? `${coupon.value}%` : String(coupon.value);
}

function formatCouponExpiry(expiresAt?: string): string {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function countCouponStats(coupons: Coupon[]) {
  let active = 0;
  let inactive = 0;
  let expired = 0;
  let totalUses = 0;
  for (const coupon of coupons) {
    totalUses += coupon.usedCount ?? 0;
    if (isCouponExpired(coupon)) expired += 1;
    else if (coupon.isActive) active += 1;
    else inactive += 1;
  }
  return {
    total: coupons.length,
    active,
    inactive,
    expired,
    totalUses,
  };
}

function couponTabCount(
  view: CouponView,
  stats: ReturnType<typeof countCouponStats>,
): number {
  if (view === "all") return stats.total;
  return stats[view];
}

type CouponStatTone = "brand" | "success" | "amber" | "muted";

type CouponOverviewItem = {
  key: string;
  tone: CouponStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function CouponOverviewStats({ items }: { items: CouponOverviewItem[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-coupons-overview"
      aria-label="Coupon overview"
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

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CouponView>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(() => {
    setLoading(true);
    listCoupons()
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => countCouponStats(coupons), [coupons]);

  const filteredCoupons = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return coupons
      .filter((coupon) => matchesView(coupon, view))
      .filter((coupon) => !q || coupon.code.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [appliedSearch, coupons, view]);

  const filtersActive = appliedSearch.trim().length > 0;

  const overviewItems = useMemo((): CouponOverviewItem[] => {
    return [
      {
        key: "total",
        tone: "brand",
        icon: <TagIcon className="h-4 w-4" aria-hidden />,
        label: "Total coupons",
        value: stats.total.toLocaleString(),
        meta: "All discount codes",
      },
      {
        key: "active",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" aria-hidden />,
        label: "Active",
        value: stats.active.toLocaleString(),
        meta: "Live at checkout",
      },
      {
        key: "inactive",
        tone: "muted",
        icon: <TagIcon className="h-4 w-4" aria-hidden />,
        label: "Inactive",
        value: stats.inactive.toLocaleString(),
        meta: "Disabled codes",
      },
      {
        key: "redemptions",
        tone: "amber",
        icon: <ChartIcon className="h-4 w-4" aria-hidden />,
        label: "Redemptions",
        value: stats.totalUses.toLocaleString(),
        meta: `${stats.expired} expired code${stats.expired === 1 ? "" : "s"}`,
      },
    ];
  }, [stats]);

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
      const payload: CouponInput = {
        type: form.type,
        value: Number(form.value || 0),
        isActive: form.isActive,
      };
      if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
      if (form.minSubtotal) payload.minSubtotal = Number(form.minSubtotal);
      if (form.maxDiscount) payload.maxDiscount = Number(form.maxDiscount);
      if (form.expiresAt) {
        payload.expiresAt = new Date(form.expiresAt).toISOString();
      }
      if (form.usageLimit) payload.usageLimit = Number(form.usageLimit);
      if (form.perUserLimit) payload.perUserLimit = Number(form.perUserLimit);
      const created = await createCoupon(payload);
      adminToast("Coupon created.", true);
      setForm(EMPTY);
      setCoupons((current) =>
        [...current, created].sort((a, b) => a.code.localeCompare(b.code)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, code: string) {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    setDeletingId(id);
    hideAdminToast();
    try {
      await deleteCoupon(id);
      adminToast("Coupon deleted.", true);
      setCoupons((current) => current.filter((coupon) => coupon._id !== id));
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminPageLayout
      section="Sales"
      title="Coupons"
      description="Create discount codes, track usage limits, and manage active promotions."
      icon={TagIcon}
      backHref="/admin/sales/orders"
      backLabel="Orders"
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <>
          <AdminOrderListCard
            icon={<TagIcon className="h-4 w-4" />}
            title="Coupon list"
            subtitle={
              loading
                ? "Loading coupons…"
                : filtersActive
                  ? `${filteredCoupons.length} coupon${filteredCoupons.length === 1 ? "" : "s"} matching search`
                  : `${filteredCoupons.length} coupon${filteredCoupons.length === 1 ? "" : "s"} in ${VIEW_LABEL[view].toLowerCase()}`
            }
            className="admin-coupons-list"
          >
            <CouponOverviewStats items={overviewItems} />

            <div className="admin-coupons-toolbar w-full">
            <div className="flex w-full flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-strong/40 pb-4 text-sm">
                {VIEW_TABS.map((tab, index) => {
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
                        onClick={() => setView(tab.id)}
                        className={
                          active
                            ? "font-semibold text-foreground"
                            : "text-brand hover:underline"
                        }
                      >
                        {tab.label} ({couponTabCount(tab.id, stats).toLocaleString()})
                      </button>
                    </span>
                  );
                })}
              </div>

              <div className="admin-coupons-filter-row flex w-full flex-wrap items-center gap-x-3 gap-y-3">
                <div className="flex min-w-[9rem] shrink-0 flex-col justify-center">
                  <h2 className="text-sm font-semibold text-foreground">
                    Coupon list
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {loading
                      ? "Loading coupons…"
                      : filtersActive
                        ? `${filteredCoupons.length} coupon${filteredCoupons.length === 1 ? "" : "s"} matching search`
                        : `${filteredCoupons.length} coupon${filteredCoupons.length === 1 ? "" : "s"} in ${VIEW_LABEL[view].toLowerCase()}`}
                  </p>
                  {filtersActive ? (
                    <span className="panel-3d-badge-amber mt-1.5 inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Search active
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    id="coupons-search"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Search code"
                    className={inputCls}
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

            <div className="panel-3d-table-wrap admin-coupons-table-wrap overflow-x-auto">
            {loading ? (
              <div className="panel-3d-empty px-6 py-12">
                <p className="text-sm text-subtle">Loading coupons…</p>
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="panel-3d-empty px-6 py-12">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <TagIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No coupons found
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {coupons.length === 0
                    ? "Create your first coupon using the form below."
                    : "Try another tab or clear your search."}
                </p>
              </div>
            ) : (
              <table className="panel-3d-table admin-coupons-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Used</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((coupon) => {
                    const expired = isCouponExpired(coupon);
                    const statusLabel = expired
                      ? "Expired"
                      : coupon.isActive
                        ? "Active"
                        : "Inactive";
                    const statusClass = expired
                      ? "dashboard-pro-status dashboard-pro-status--brand"
                      : coupon.isActive
                        ? "dashboard-pro-status dashboard-pro-status--green"
                        : "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted";

                    return (
                      <tr key={coupon._id}>
                        <td className="font-mono font-semibold text-brand">
                          {coupon.code}
                        </td>
                        <td className="capitalize text-foreground-muted">
                          {coupon.type}
                        </td>
                        <td className="font-semibold text-foreground">
                          {formatCouponValue(coupon)}
                        </td>
                        <td className="text-foreground-muted">
                          {coupon.usedCount ?? 0}
                          {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                        </td>
                        <td className="text-foreground-muted">
                          {formatCouponExpiry(coupon.expiresAt)}
                        </td>
                        <td>
                          <span className={statusClass}>{statusLabel}</span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            disabled={deletingId === coupon._id}
                            onClick={() => onDelete(coupon._id, coupon.code)}
                            className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs text-rose-300 disabled:opacity-50"
                          >
                            {deletingId === coupon._id ? "Deleting…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            </div>
          </AdminOrderListCard>

          <form onSubmit={onSave}>
            <ProductFormOrderCard
              className="admin-product-form-section admin-coupons-form"
              icon={<TagIcon className="h-4 w-4" />}
              title="New coupon"
              subtitle="Leave code blank to auto-generate."
            >
              <div className="admin-product-form-sidebar-fields space-y-4">
                <div>
                  <label htmlFor="coupon-code" className={labelCls}>
                    Code
                  </label>
                  <input
                    id="coupon-code"
                    value={form.code}
                    onChange={(e) => setFormField("code", e.target.value)}
                    placeholder="SUMMER20"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="coupon-type" className={labelCls}>
                Type
              </label>
              <AdminSelect
                id="coupon-type"
                value={form.type}
                onChange={(v) => setFormField("type", v as CouponType)}
                className="w-full"
                options={[
                  { value: "percent", label: "Percent" },
                  { value: "fixed", label: "Fixed" },
                ]}
              />
            </div>
            <div>
              <label htmlFor="coupon-value" className={labelCls}>
                Value {form.type === "percent" ? "(%)" : ""}
              </label>
              <input
                id="coupon-value"
                type="number"
                step="0.01"
                required
                value={form.value}
                onChange={(e) => setFormField("value", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="coupon-min-subtotal" className={labelCls}>
                Min subtotal
              </label>
              <input
                id="coupon-min-subtotal"
                type="number"
                step="0.01"
                value={form.minSubtotal}
                onChange={(e) => setFormField("minSubtotal", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="coupon-max-discount" className={labelCls}>
                Max discount
              </label>
              <input
                id="coupon-max-discount"
                type="number"
                step="0.01"
                value={form.maxDiscount}
                onChange={(e) => setFormField("maxDiscount", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="coupon-usage-limit" className={labelCls}>
                Usage limit
              </label>
              <input
                id="coupon-usage-limit"
                type="number"
                value={form.usageLimit}
                onChange={(e) => setFormField("usageLimit", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="coupon-per-user-limit" className={labelCls}>
                Per-user limit
              </label>
              <input
                id="coupon-per-user-limit"
                type="number"
                value={form.perUserLimit}
                onChange={(e) => setFormField("perUserLimit", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="coupon-expires-at" className={labelCls}>
              Expires at
            </label>
            <input
              id="coupon-expires-at"
              type="date"
              value={form.expiresAt}
              onChange={(e) => setFormField("expiresAt", e.target.value)}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setFormField("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-border accent-brand"
            />
            Active at checkout
          </label>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create coupon"}
          </button>
              </div>
            </ProductFormOrderCard>
          </form>
          </>
        }
      />
    </AdminPageLayout>
  );
}
