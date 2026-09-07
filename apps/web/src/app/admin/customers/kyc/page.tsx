"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useEffect, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  CloseIcon,
  PulseIcon,
  ShieldIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  adminApproveKycRequest,
  adminListKycRequests,
  adminRejectKycRequest,
  getKycAdminOverview,
  type AdminKycRequest,
  type KycAdminOverview,
  type KycRequestStatus,
} from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  pending: "dashboard-pro-status dashboard-pro-status--amber",
  verified: "dashboard-pro-status dashboard-pro-status--green",
  rejected: "dashboard-pro-status dashboard-pro-status--brand",
};

const DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  driver_license: "Driver license",
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

function KycOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="customer-dashboard-overview-stat-copy min-w-0">
      <span className="customer-dashboard-overview-stat-label">{label}</span>
      <span className="customer-dashboard-overview-stat-value">{value}</span>
      <p className="customer-dashboard-overview-stat-meta">{meta}</p>
    </div>
  );
}

function mergeRequestAfterAction(
  current: AdminKycRequest[],
  updated: AdminKycRequest,
  statusFilter: KycRequestStatus | "",
): AdminKycRequest[] {
  if (statusFilter && updated.status !== statusFilter) {
    return current.filter((row) => row._id !== updated._id);
  }
  return current.map((row) => (row._id === updated._id ? updated : row));
}

function patchOverviewAfterReview(
  current: KycAdminOverview | null,
  outcome: "verified" | "rejected",
): KycAdminOverview | null {
  if (!current) return current;
  return {
    ...current,
    pending: Math.max(0, current.pending - 1),
    verified:
      outcome === "verified" ? current.verified + 1 : current.verified,
    rejected:
      outcome === "rejected" ? current.rejected + 1 : current.rejected,
  };
}

export default function AdminKycPage() {
  const [overview, setOverview] = useState<KycAdminOverview | null>(null);
  const [requests, setRequests] = useState<AdminKycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<KycRequestStatus | "">(
    "pending",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminKycRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
    const requestsCacheKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    getKycAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cacheKey = `${statusFilter || "all"}:${query.trim()}`;
    if (requestsCacheKeyRef.current === cacheKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminListKycRequests({
        status: statusFilter || undefined,
        q: query || undefined,
        limit: 50,
      })
        .then((r) => {
          if (!cancelled) {
            setRequests(r.items);
            requestsCacheKeyRef.current = cacheKey;
          }
        })
        .catch(() => {
          if (!cancelled) setRequests([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [statusFilter, query]);

  function reloadOverview() {
    getKycAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }

  function clearPanel() {
    setSelected(null);
    setRejectReason("");
  }

  function closePanel() {
    if (busy) return;
    clearPanel();
  }

  function openRequest(row: AdminKycRequest) {
    if (busy) return;
    setSelected(row);
    setRejectReason(row.rejectionReason ?? "");
  }

  async function onApprove() {
    if (!selected) return;
    const wasPending = selected.status === "pending";
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await adminApproveKycRequest(selected._id);
      setRequests((current) =>
        mergeRequestAfterAction(current, updated, statusFilter),
      );
      if (wasPending) {
        setOverview((current) => patchOverviewAfterReview(current, "verified"));
      } else {
        reloadOverview();
      }
      adminToast("KYC request approved.", true);
      clearPanel();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Approve failed.", false);
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!selected) return;
    const wasPending = selected.status === "pending";
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await adminRejectKycRequest(
        selected._id,
        rejectReason.trim() || undefined,
      );
      setRequests((current) =>
        mergeRequestAfterAction(current, updated, statusFilter),
      );
      if (wasPending) {
        setOverview((current) => patchOverviewAfterReview(current, "rejected"));
      } else {
        reloadOverview();
      }
      adminToast("KYC request rejected.", true);
      clearPanel();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reject failed.", false);
    } finally {
      setBusy(false);
    }
  }

  const filtersActive = Boolean(query || (statusFilter && statusFilter !== "pending"));

  return (
    <AdminPageLayout
      section="Customers"
      title="KYC requests"
      description="Review identity verification submissions — inspect documents, approve verified users, or reject with feedback."
      icon={ShieldIcon}
      backHref="/admin/customers"
      backLabel="All customers"
    >

      <AdminOrderTwoColumnLayout
        main={
          <AdminOrderListCard
            icon={<ShieldIcon className="h-4 w-4" />}
            title="Request list"
            subtitle={
              loading
                ? "Loading requests…"
                : `${requests.length.toLocaleString()} request${requests.length === 1 ? "" : "s"} shown`
            }
            className="admin-kyc-catalog"
          >
            {overview ? (
              <section
                className="customer-dashboard-overview-section admin-kyc-overview"
                aria-label="KYC overview"
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
                      <ShieldIcon className="h-4 w-4" />
                    </span>
                    <KycOverviewStatCopy
                      label="Total requests"
                      value={overview.total.toLocaleString()}
                      meta="All submissions"
                    />
                  </div>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "pending"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "pending" ? "" : "pending")
                    }
                    className={overviewStatClass("amber", statusFilter === "pending")}
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
                    <KycOverviewStatCopy
                      label="Pending"
                      value={overview.pending.toLocaleString()}
                      meta="Needs review"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "verified"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "verified" ? "" : "verified")
                    }
                    className={overviewStatClass("success", statusFilter === "verified")}
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
                    <KycOverviewStatCopy
                      label="Verified"
                      value={overview.verified.toLocaleString()}
                      meta="Approved users"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "rejected"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "rejected" ? "" : "rejected")
                    }
                    className={overviewStatClass("muted", statusFilter === "rejected")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <CloseIcon className="h-4 w-4" />
                    </span>
                    <KycOverviewStatCopy
                      label="Rejected"
                      value={overview.rejected.toLocaleString()}
                      meta="Needs resubmission"
                    />
                  </button>
                </div>
              </section>
            ) : null}

            <div className="admin-products-filters-list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {filtersActive ? (
                  <>
                    <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex">
                      Filters active
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("pending");
                      }}
                      className="dashboard-pro-btn-ghost shrink-0 text-xs"
                    >
                      Reset filters
                    </button>
                  </>
                ) : null}
              </div>

              <div className="admin-products-filters-row">
                <div className="admin-products-filter-field min-w-0 col-span-2 sm:col-span-1">
                  <label htmlFor="kyc-search" className="admin-products-filter-label">
                    Search
                  </label>
                  <input
                    id="kyc-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search customer name or email…"
                    className={inputCls}
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="kyc-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <AdminSelect
                    id="kyc-status"
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as KycRequestStatus | "")}
                    className="w-full"
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "pending", label: "Pending" },
                      { value: "verified", label: "Verified" },
                      { value: "rejected", label: "Rejected" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="admin-products-table-empty">Loading KYC requests…</div>
            ) : requests.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <ShieldIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No KYC requests found
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try clearing filters or adjusting your search."
                    : "New verification submissions will appear here."}
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap admin-kyc-table-wrap overflow-x-auto">
                <table className="admin-kyc-table w-full">
                  <thead className="admin-kyc-table-head">
                    <tr>
                      <th>Customer</th>
                      <th>Document</th>
                      <th>Files</th>
                      <th>Submitted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((row) => (
                      <tr
                        key={row._id}
                        onClick={() => void openRequest(row)}
                        className="cursor-pointer"
                      >
                        <td className="text-xs">
                          <p className="font-medium text-foreground">
                            {row.displayName ?? row.email ?? "Unknown user"}
                          </p>
                          {row.email ? (
                            <p className="text-subtle">{row.email}</p>
                          ) : null}
                        </td>
                        <td className="text-xs capitalize">
                          {DOC_LABELS[row.documentType] ?? row.documentType}
                        </td>
                        <td className="text-xs text-foreground-muted">
                          {row.fileUrls.length} file
                          {row.fileUrls.length === 1 ? "" : "s"}
                        </td>
                        <td className="text-xs text-foreground-muted">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`capitalize ${
                              STATUS_STYLE[row.status] ?? "dashboard-pro-status"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminOrderListCard>
        }
        sidebar={
          <ProductFormOrderCard
            className="admin-product-form-section admin-kyc-review-guide"
            title="Review guide"
            subtitle="How to process verification requests"
          >
            <div className="space-y-2 text-xs text-foreground-muted">
              <p>Open a request to view uploaded documents and approve or reject.</p>
              <p>Approved users get verified KYC status on their account.</p>
              <p>Rejected users can submit again with corrected documents.</p>
            </div>
          </ProductFormOrderCard>
        }
      />

      {selected ? (
        <SlideOver title="KYC review" onClose={closePanel}>
          <p className="font-medium text-foreground">
            {selected.displayName ?? selected.email ?? selected.userId}
          </p>
          {selected.email ? (
            <p className="mt-1 text-xs text-subtle">{selected.email}</p>
          ) : null}
          <p className="mt-2 text-xs text-foreground-muted">
            Document:{" "}
            <span className="capitalize text-foreground">
              {DOC_LABELS[selected.documentType] ?? selected.documentType}
            </span>
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Status:{" "}
            <span
              className={`capitalize ${
                STATUS_STYLE[selected.status] ?? "dashboard-pro-status"
              }`}
            >
              {selected.status}
            </span>
          </p>

          <div className="mt-4 space-y-2">
            <p className={labelCls}>Uploaded files</p>
            {selected.fileUrls.length === 0 ? (
              <p className="text-xs text-subtle">No files attached.</p>
            ) : (
              selected.fileUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-kyc-file-link block truncate text-xs text-brand hover:underline"
                >
                  {url}
                </a>
              ))
            )}
          </div>

          {selected.status === "pending" ? (
            <>
              <div className="mt-4">
                <label htmlFor="kyc-reject-reason" className={labelCls}>
                  Rejection reason (optional)
                </label>
                <textarea
                  id="kyc-reject-reason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain what needs to be corrected…"
                  className={`${inputCls} min-h-[5rem] resize-y text-sm`}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={busy}
                  className="dashboard-pro-btn-ghost text-rose-400 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </>
          ) : selected.rejectionReason ? (
            <p className="mt-4 text-xs text-foreground-muted">
              Rejection reason: {selected.rejectionReason}
            </p>
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
    <div className="admin-kyc-drawer fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close review panel"
        className="admin-kyc-drawer-backdrop flex-1 bg-black/50"
        onClick={onClose}
      />
      <div className="admin-kyc-drawer-panel h-full w-full max-w-md overflow-y-auto border-l border-border bg-elevated p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
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
