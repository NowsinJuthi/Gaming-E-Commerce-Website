"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  ChartIcon,
  CheckIcon,
  DollarIcon,
  LinkIcon,
  TagIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  adminListAffiliateCommissions,
  adminListAffiliates,
  adminUpdateAffiliate,
  approveAffiliateCommission,
  getAffiliateAdminOverview,
  getAffiliatePayoutReport,
  rejectAffiliateCommission,
  type AdminAffiliateRow,
  type AffiliateAdminOverview,
  type AffiliateCommission,
  type AffiliateCommissionStatus,
  type AffiliatePayoutReport,
  type AffiliateStatus,
} from "@/lib/api";

type Tab = "affiliates" | "commissions" | "payouts";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "affiliates", label: "Affiliates" },
  { id: "commissions", label: "Commissions" },
  { id: "payouts", label: "Payout report" },
];

const COMM_STATUSES: AffiliateCommissionStatus[] = [
  "pending",
  "paid",
  "rejected",
  "reversed",
];

const STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  paid: "dashboard-pro-status dashboard-pro-status--green",
  rejected: "dashboard-pro-status dashboard-pro-status--brand",
  reversed: "dashboard-pro-status",
  active: "dashboard-pro-status dashboard-pro-status--green",
  disabled: "dashboard-pro-status",
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

function AffiliateOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: ReactNode;
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

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<Tab>("affiliates");
  const [overview, setOverview] = useState<AffiliateAdminOverview | null>(null);
  const [affiliates, setAffiliates] = useState<AdminAffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payoutReport, setPayoutReport] =
    useState<AffiliatePayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [affStatus, setAffStatus] = useState<AffiliateStatus | "">("");
  const [affQ, setAffQ] = useState("");
  const [commStatus, setCommStatus] = useState<AffiliateCommissionStatus | "">(
    "pending",
  );
  const [selectedAff, setSelectedAff] = useState<AdminAffiliateRow | null>(null);
  const [selectedComm, setSelectedComm] =
    useState<AffiliateCommission | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editStatus, setEditStatus] = useState<AffiliateStatus>("active");
  const [busy, setBusy] = useState(false);
    const payoutLoadedRef = useRef(false);
  const affiliatesCacheKeyRef = useRef("");
  const commissionsCacheKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    getAffiliateAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    getAffiliatePayoutReport()
      .then((data) => {
        if (!cancelled) {
          setPayoutReport(data);
          payoutLoadedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setPayoutReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "affiliates") return;
    const cacheKey = `${affStatus || "all"}:${affQ.trim()}`;
    if (affiliatesCacheKeyRef.current === cacheKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminListAffiliates({
        status: affStatus || undefined,
        q: affQ || undefined,
        limit: 50,
      })
        .then((r) => {
          if (!cancelled) {
            setAffiliates(r.items);
            affiliatesCacheKeyRef.current = cacheKey;
          }
        })
        .catch(() => {
          if (!cancelled) setAffiliates([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, affStatus, affQ]);

  useEffect(() => {
    if (tab !== "commissions") return;
    const cacheKey = commStatus || "all";
    if (commissionsCacheKeyRef.current === cacheKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminListAffiliateCommissions({
        status: commStatus || undefined,
        limit: 50,
      })
        .then((r) => {
          if (!cancelled) {
            setCommissions(r.items);
            commissionsCacheKeyRef.current = cacheKey;
          }
        })
        .catch(() => {
          if (!cancelled) setCommissions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, commStatus]);

  useEffect(() => {
    if (tab !== "payouts") return;
    setLoading(!payoutLoadedRef.current && !payoutReport);
  }, [tab, payoutReport]);

  function reloadOverview() {
    getAffiliateAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }

  function reloadPayoutReport() {
    getAffiliatePayoutReport()
      .then((data) => {
        setPayoutReport(data);
        payoutLoadedRef.current = true;
      })
      .catch(() => setPayoutReport(null));
  }

  function closeAffiliatePanel() {
    setSelectedAff(null);
  }

  function closeCommissionPanel() {
    setSelectedComm(null);
  }

  function openAffiliate(row: AdminAffiliateRow) {
    if (busy) return;
    setSelectedComm(null);
    setSelectedAff(row);
    setEditRate(String(Math.round(row.commissionRate * 100)));
    setEditStatus(row.status);
  }

  function openCommission(c: AffiliateCommission) {
    if (busy) return;
    setSelectedAff(null);
    setSelectedComm(c);
  }

  async function saveAffiliateConfig() {
    if (!selectedAff) return;
    const rate = Number(editRate) / 100;
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      adminToast("Commission rate must be 0–100%.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      await adminUpdateAffiliate(selectedAff._id, {
        status: editStatus,
        commissionRate: rate,
      });
      setAffiliates((current) =>
        current.map((row) =>
          row._id === selectedAff._id
            ? { ...row, status: editStatus, commissionRate: rate }
            : row,
        ),
      );
      adminToast("Affiliate updated.", true);
      closeAffiliatePanel();
      reloadOverview();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function approveCommission() {
    if (!selectedComm) return;
    setBusy(true);
    hideAdminToast();
    try {
      await approveAffiliateCommission(selectedComm._id);
      setCommissions((current) =>
        current.filter((row) => row._id !== selectedComm._id),
      );
      adminToast("Commission approved and credited to wallet.", true);
      closeCommissionPanel();
      reloadOverview();
      reloadPayoutReport();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Approve failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function rejectCommission() {
    if (!selectedComm) return;
    const note = prompt("Rejection reason (optional):");
    if (note === null) return;
    setBusy(true);
    hideAdminToast();
    try {
      await rejectAffiliateCommission(selectedComm._id, note || undefined);
      setCommissions((current) =>
        current.filter((row) => row._id !== selectedComm._id),
      );
      adminToast("Commission rejected.", true);
      closeCommissionPanel();
      reloadOverview();
      reloadPayoutReport();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reject failed", false);
    } finally {
      setBusy(false);
    }
  }

  const affFiltersActive = Boolean(affQ || affStatus);
  const listCount =
    tab === "affiliates"
      ? affiliates.length
      : tab === "commissions"
        ? commissions.length
        : (payoutReport?.affiliates.length ?? 0);

  return (
    <AdminPageLayout
      section="Customers"
      title="Affiliates"
      description="Manage referral partners — track clicks and conversions, review commissions, and run payout reports."
      icon={LinkIcon}
      backHref="/admin/customers"
      backLabel="All customers"
    >

      <AdminOrderTwoColumnLayout
        main={
          <AdminOrderListCard
            icon={<LinkIcon className="h-4 w-4" />}
            title={
              tab === "affiliates"
                ? "Affiliate list"
                : tab === "commissions"
                  ? "Commission queue"
                  : "Payout report"
            }
            subtitle={
              loading
                ? "Loading…"
                : tab === "payouts"
                  ? `${listCount.toLocaleString()} affiliate${listCount === 1 ? "" : "s"} in report`
                  : `${listCount.toLocaleString()} ${tab === "affiliates" ? "affiliate" : "commission"}${listCount === 1 ? "" : "s"} shown`
            }
            className="admin-affiliates-catalog"
          >
            {overview ? (
              <section
                className="customer-dashboard-overview-section admin-affiliates-overview"
                aria-label="Affiliate overview"
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
                      <LinkIcon className="h-4 w-4" />
                    </span>
                    <AffiliateOverviewStatCopy
                      label="Total affiliates"
                      value={overview.affiliates.total.toLocaleString()}
                      meta="Referral partners"
                    />
                  </div>

                  <button
                    type="button"
                    aria-pressed={affStatus === "active" && tab === "affiliates"}
                    onClick={() => {
                      setTab("affiliates");
                      setAffStatus(affStatus === "active" ? "" : "active");
                    }}
                    className={overviewStatClass(
                      "success",
                      affStatus === "active" && tab === "affiliates",
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
                    <AffiliateOverviewStatCopy
                      label="Active"
                      value={overview.affiliates.active.toLocaleString()}
                      meta="Earning referrals"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={tab === "commissions" && commStatus === "pending"}
                    onClick={() => {
                      setTab("commissions");
                      setCommStatus("pending");
                    }}
                    className={overviewStatClass(
                      "amber",
                      tab === "commissions" && commStatus === "pending",
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
                      <DollarIcon className="h-4 w-4" />
                    </span>
                    <AffiliateOverviewStatCopy
                      label="Pending payout"
                      value={
                        <PriceText
                          amount={overview.payouts.pending}
                          currency="BDT"
                        />
                      }
                      meta="Awaiting approval"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={tab === "payouts"}
                    onClick={() => setTab("payouts")}
                    className={overviewStatClass("amber", tab === "payouts")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <ChartIcon className="h-4 w-4" />
                    </span>
                    <AffiliateOverviewStatCopy
                      label="Conversions"
                      value={overview.tracking.conversions.toLocaleString()}
                      meta={`${overview.tracking.clicks.toLocaleString()} clicks · ${overview.tracking.signups.toLocaleString()} signups`}
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
                      <WalletIcon className="h-4 w-4" />
                    </span>
                    <AffiliateOverviewStatCopy
                      label="Paid out"
                      value={
                        <PriceText
                          amount={overview.payouts.paid}
                          currency="BDT"
                        />
                      }
                      meta="Completed payouts"
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
                    <AffiliateOverviewStatCopy
                      label="Default rate"
                      value={`${Math.round(overview.defaultCommissionRate * 100)}%`}
                      meta={`${overview.affiliates.disabled.toLocaleString()} disabled`}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <div className="admin-products-filters-list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {tab === "affiliates" && affFiltersActive ? (
                  <>
                    <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex">
                      Filters active
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAffQ("");
                        setAffStatus("");
                      }}
                      className="dashboard-pro-btn-ghost shrink-0 text-xs"
                    >
                      Clear filters
                    </button>
                  </>
                ) : null}
                {tab === "commissions" && commStatus ? (
                  <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex capitalize">
                    {commStatus} only
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-strong/40 pb-4 text-sm">
                {TABS.map((item, index) => {
                  const active = tab === item.id;
                  const count =
                    item.id === "affiliates"
                      ? (overview?.affiliates.total ?? affiliates.length)
                      : item.id === "commissions"
                        ? (overview?.payouts.count ?? commissions.length)
                        : (payoutReport?.affiliates.length ?? 0);
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
                        className={`admin-affiliates-tab ${
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

              {tab === "affiliates" ? (
                <div className="admin-products-filters-row">
                  <div className="admin-products-filter-field min-w-0 col-span-2 sm:col-span-1">
                    <label
                      htmlFor="affiliate-search"
                      className="admin-products-filter-label"
                    >
                      Search
                    </label>
                    <input
                      id="affiliate-search"
                      value={affQ}
                      onChange={(e) => setAffQ(e.target.value)}
                      placeholder="Search referral code…"
                      className={inputCls}
                    />
                  </div>
                  <div className="admin-products-filter-field min-w-0">
                    <label
                      htmlFor="affiliate-status"
                      className="admin-products-filter-label"
                    >
                      Status
                    </label>
                    <AdminSelect
                      id="affiliate-status"
                      value={affStatus}
                      onChange={(v) => setAffStatus(v as AffiliateStatus | "")}
                      className="w-full"
                      options={[
                        { value: "", label: "All statuses" },
                        { value: "active", label: "Active" },
                        { value: "disabled", label: "Disabled" },
                      ]}
                    />
                  </div>
                </div>
              ) : null}

              {tab === "commissions" ? (
                <div className="admin-products-filter-field min-w-0 max-w-xs">
                  <label
                    htmlFor="commission-status"
                    className="admin-products-filter-label"
                  >
                    Status
                  </label>
                  <AdminSelect
                    id="commission-status"
                    value={commStatus}
                    onChange={(v) =>
                      setCommStatus(v as AffiliateCommissionStatus | "")
                    }
                    className="w-full"
                    options={[
                      { value: "", label: "All statuses" },
                      ...COMM_STATUSES.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </div>
              ) : null}
            </div>

            {tab === "affiliates" ? (
              <AffiliateTable
                loading={loading}
                rows={affiliates}
                filtersActive={affFiltersActive}
                onRowClick={openAffiliate}
              />
            ) : null}

            {tab === "commissions" ? (
              <CommissionTable
                loading={loading}
                rows={commissions}
                commStatus={commStatus}
                onRowClick={openCommission}
              />
            ) : null}

            {tab === "payouts" ? (
              loading || !payoutReport ? (
                <div className="admin-products-table-empty">
                  Loading payout report…
                </div>
              ) : (
                <div className="admin-products-table-wrap admin-affiliates-table-wrap overflow-x-auto">
                  <table className="admin-affiliates-table w-full">
                  <thead className="admin-affiliates-table-head">
                    <tr>
                      <th>Affiliate</th>
                      <th>Pending</th>
                      <th>Paid</th>
                      <th>Rejected</th>
                      <th>Reversed</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-semibold text-foreground">
                      <td>All affiliates</td>
                      <td>
                        <PriceText amount={payoutReport.totals.pending} currency={"BDT"} />
                      </td>
                      <td><PriceText amount={payoutReport.totals.paid} currency={"BDT"} /></td>
                      <td>
                        <PriceText amount={payoutReport.totals.rejected} currency={"BDT"} />
                      </td>
                      <td>
                        <PriceText amount={payoutReport.totals.reversed} currency={"BDT"} />
                      </td>
                      <td>{payoutReport.totals.count}</td>
                    </tr>
                    {payoutReport.affiliates.map((row) => (
                      <tr key={row.affiliateId}>
                        <td className="font-mono text-xs">
                          …{row.affiliateId.slice(-8)}
                        </td>
                        <td><PriceText amount={row.pending} currency={"BDT"} /></td>
                        <td><PriceText amount={row.paid} currency={"BDT"} /></td>
                        <td><PriceText amount={row.rejected} currency={"BDT"} /></td>
                        <td><PriceText amount={row.reversed} currency={"BDT"} /></td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )
            ) : null}
          </AdminOrderListCard>
        }
        sidebar={
          <ProductFormOrderCard
            className="admin-product-form-section admin-affiliates-config"
            title="Affiliate config"
            subtitle="Referral defaults and payout flow"
          >
            {overview ? (
              <div className="space-y-2 text-xs text-foreground-muted">
                <p>
                  <span className="text-subtle">Default rate:</span>{" "}
                  {Math.round(overview.defaultCommissionRate * 100)}%
                </p>
                <p className="break-all">
                  <span className="text-subtle">Link template:</span>{" "}
                  {overview.referralLinkTemplate}
                </p>
                <p>
                  <span className="text-subtle">Click TTL:</span> 90 days
                </p>
                <p>
                  <span className="text-subtle">Attribution:</span> first-touch
                </p>
                <hr className="my-3 border-border" />
                <p className="font-semibold text-foreground">Payout flow</p>
                <p>Order paid → pending commission</p>
                <p>Admin approve → wallet credit</p>
                <p>Refund → reversed</p>
                <hr className="my-3 border-border" />
                <p>
                  Paid out:{" "}
                  <span className="text-emerald-300">
                    <PriceText amount={overview.payouts.paid} currency={"BDT"} />
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-subtle">Loading config…</p>
            )}
          </ProductFormOrderCard>
        }
      />

      {selectedAff ? (
        <SlideOver title="Affiliate config" onClose={closeAffiliatePanel}>
          <p className="font-mono text-sm text-brand">{selectedAff.code}</p>
          <p className="mt-1 text-foreground">
            {selectedAff.displayName ?? selectedAff.email ?? selectedAff.userId}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Clicks {selectedAff.clicks} · Signups {selectedAff.signups} ·
            Conversions {selectedAff.conversions}
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Commission rate (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Status">
              <AdminSelect
                value={editStatus}
                onChange={(v) => setEditStatus(v as AffiliateStatus)}
                className="w-full"
                options={[
                  { value: "active", label: "Active" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </Field>
            <button
              type="button"
              onClick={saveAffiliateConfig}
              disabled={busy}
              className="btn-primary w-full disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </SlideOver>
      ) : null}

      {selectedComm ? (
        <SlideOver title="Commission" onClose={closeCommissionPanel}>
          <p className="text-2xl font-bold text-foreground">
            <PriceText amount={selectedComm.amount} currency={selectedComm.currency} />
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            {Math.round(selectedComm.rate * 100)}% of{" "}
            <PriceText amount={selectedComm.baseAmount} currency={selectedComm.currency} />
          </p>
          <p className="mt-3">
            <span
              className={`capitalize ${
                STATUS_STYLE[selectedComm.status] ?? "dashboard-pro-status"
              }`}
            >
              {selectedComm.status}
            </span>
          </p>
          <p className="mt-4 font-mono text-xs text-subtle">
            Order …{selectedComm.orderId.slice(-8)}
          </p>
          {selectedComm.note ? (
            <p className="mt-2 text-sm text-amber-300">{selectedComm.note}</p>
          ) : null}
          {selectedComm.status === "pending" ? (
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={approveCommission}
                disabled={busy}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Approve payout
              </button>
              <button
                type="button"
                onClick={rejectCommission}
                disabled={busy}
                className="dashboard-pro-btn-ghost flex-1 text-rose-400 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : null}
        </SlideOver>
      ) : null}
    </AdminPageLayout>
  );
}

function SlideOver({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-affiliates-drawer fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close panel"
        className="admin-affiliates-drawer-backdrop flex-1 bg-black/50"
        onClick={onClose}
      />
      <div className="admin-affiliates-drawer-panel h-full w-full max-w-md overflow-y-auto border-l border-border bg-elevated p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
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

function AffiliateTable({
  loading,
  rows,
  filtersActive,
  onRowClick,
}: {
  loading: boolean;
  rows: AdminAffiliateRow[];
  filtersActive: boolean;
  onRowClick: (row: AdminAffiliateRow) => void;
}) {
  if (loading) {
    return (
      <div className="dashboard-pro-empty p-10">
        <p className="text-sm text-subtle">Loading affiliates…</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="dashboard-pro-empty p-10">
        <span className="dashboard-pro-empty-icon" aria-hidden>
          <LinkIcon className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium text-foreground">
          No affiliates found
        </p>
        <p className="mt-1 text-xs text-subtle">
          {filtersActive
            ? "Try clearing filters or adjusting your search."
            : "Affiliates appear here once registered."}
        </p>
      </div>
    );
  }
  return (
    <table className="admin-affiliates-table w-full">
      <thead className="admin-affiliates-table-head">
        <tr>
          <th>Code</th>
          <th>User</th>
          <th>Rate</th>
          <th>Tracking</th>
          <th>Earned</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr
            key={a._id}
            onClick={() => void onRowClick(a)}
            className="cursor-pointer"
          >
            <td className="font-mono font-semibold text-foreground">{a.code}</td>
            <td className="text-xs">
              {a.displayName ?? a.email ?? `…${a.userId.slice(-6)}`}
            </td>
            <td>{Math.round(a.commissionRate * 100)}%</td>
            <td className="text-xs text-foreground-muted">
              {a.clicks}c · {a.signups}s · {a.conversions}v
            </td>
            <td><PriceText amount={a.totalEarned} currency={"BDT"} /></td>
            <td>
              <span
                className={`capitalize ${
                  STATUS_STYLE[a.status] ?? "dashboard-pro-status"
                }`}
              >
                {a.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CommissionTable({
  loading,
  rows,
  commStatus,
  onRowClick,
}: {
  loading: boolean;
  rows: AffiliateCommission[];
  commStatus: AffiliateCommissionStatus | "";
  onRowClick: (row: AffiliateCommission) => void;
}) {
  if (loading) {
    return (
      <div className="dashboard-pro-empty p-10">
        <p className="text-sm text-subtle">Loading commissions…</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="dashboard-pro-empty p-10">
        <span className="dashboard-pro-empty-icon" aria-hidden>
          <LinkIcon className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium text-foreground">
          No commissions found
        </p>
        <p className="mt-1 text-xs text-subtle">
          {commStatus
            ? `No ${commStatus} commissions in this view.`
            : "Commissions appear when referred orders are paid."}
        </p>
      </div>
    );
  }
  return (
    <table className="admin-affiliates-table w-full">
      <thead className="admin-affiliates-table-head">
        <tr>
          <th>Order</th>
          <th>Base</th>
          <th>Commission</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr
            key={c._id}
            onClick={() => void onRowClick(c)}
            className="cursor-pointer"
          >
            <td className="font-mono text-xs">…{c.orderId.slice(-8)}</td>
            <td><PriceText amount={c.baseAmount} currency={c.currency} /></td>
            <td className="font-semibold text-foreground">
              <PriceText amount={c.amount} currency={c.currency} />
            </td>
            <td>
              <span
                className={`capitalize ${
                  STATUS_STYLE[c.status] ?? "dashboard-pro-status"
                }`}
              >
                {c.status}
              </span>
            </td>
            <td className="text-foreground-muted">
              {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
