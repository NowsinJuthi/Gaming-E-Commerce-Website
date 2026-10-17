"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ReceiptIcon } from "@/components/admin/icons";
import { getCustomerDisplayName } from "@/lib/admin-order-view";
import { adminListCustomers } from "@/lib/api";
import {
  formatMediaPlanCents,
  mediaSubscriptionApi,
} from "@/lib/media-subscription-api";
import {
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  type AdminSubscriptionRow,
} from "@/lib/media-subscription-types";

const GRANT_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trial,
  SubscriptionStatus.Pending,
] as const;

function statusClass(status: string): string {
  switch (status) {
    case SubscriptionStatus.Active:
    case SubscriptionStatus.Trial:
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case SubscriptionStatus.Pending:
      return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    case SubscriptionStatus.Suspended:
      return "bg-red-500/15 text-red-300 ring-red-500/30";
    default:
      return "bg-white/10 text-white/70 ring-white/20";
  }
}

export default function MovieServerSubscriptionsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [filterUserId, setFilterUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [grant, setGrant] = useState<{
    userId: string;
    planSlug: string;
    billingCycle: string;
    status: string;
  }>({
    userId: "",
    planSlug: "standard",
    billingCycle: "monthly",
    status: SubscriptionStatus.Active,
  });
  const [grantSearch, setGrantSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: "suspend" | "unsuspend" | "activate" | "delete";
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const userId = searchParams.get("userId")?.trim();
    if (userId) setFilterUserId(userId);
  }, [searchParams]);

  const query = useQuery({
    queryKey: ["admin-media-subs", filterUserId, statusFilter],
    queryFn: () =>
      mediaSubscriptionApi.subscriptions({
        userId: filterUserId || undefined,
        status: statusFilter || undefined,
      }),
  });

  const plansQuery = useQuery({
    queryKey: ["admin-media-plans"],
    queryFn: mediaSubscriptionApi.adminPlans,
  });

  const customerSearch = useQuery({
    queryKey: ["admin-customer-pick", grantSearch],
    queryFn: () => adminListCustomers({ q: grantSearch, limit: 8 }),
    enabled: grantSearch.trim().length >= 2,
  });

  const stats = useMemo(() => {
    const rows = query.data?.subscriptions ?? [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === SubscriptionStatus.Active).length,
      trial: rows.filter((r) => r.status === SubscriptionStatus.Trial).length,
      entitled: rows.filter((r) => r.entitled).length,
    };
  }, [query.data?.subscriptions]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-media-subs"] });

  const grantMut = useMutation({
    mutationFn: () => mediaSubscriptionApi.grantSubscription(grant),
    onSuccess: () => {
      setFormError(null);
      void refresh();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Grant failed.");
    },
  });

  const actionMut = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "suspend" | "unsuspend" | "activate" | "delete";
    }) => {
      if (action === "suspend") return mediaSubscriptionApi.suspendSubscription(id);
      if (action === "unsuspend") return mediaSubscriptionApi.unsuspendSubscription(id);
      if (action === "delete") {
        await mediaSubscriptionApi.deleteSubscription(id);
        return null;
      }
      return mediaSubscriptionApi.activateSubscription(id);
    },
    onSuccess: () => {
      setPendingAction(null);
      void refresh();
    },
  });

  const plans = plansQuery.data?.plans ?? [];
  const rows = query.data?.subscriptions ?? [];

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Subscriptions"
      description="Grant movie server access, activate payments, and manage subscription status."
      icon={ReceiptIcon}
      loading={query.isLoading}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Listed" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Trial" value={stats.trial} />
        <Stat label="Entitled now" value={stats.entitled} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          placeholder="Filter by user ID"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value.trim())}
        />
        <select
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-base font-semibold text-white">Grant complimentary access</h2>
          <p className="mt-1 text-sm text-white/50">
            Replaces the customer&apos;s current movie subscription.
          </p>
          <form
            className="mt-4 grid gap-3 lg:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!grant.userId) return;
              grantMut.mutate();
            }}
          >
            <div className="relative lg:col-span-2">
              <input
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                placeholder="Search customer by email or name"
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
              />
              {customerSearch.data?.items?.length ? (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/10 bg-[#1a1a24] shadow-lg">
                  {customerSearch.data.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setGrant({ ...grant, userId: c.id });
                          setGrantSearch(getCustomerDisplayName(c));
                          setCustomerQuery(c.email);
                        }}
                      >
                        {getCustomerDisplayName(c)}{" "}
                        <span className="text-white/45">({c.email})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <input
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm lg:col-span-2"
              placeholder="User ID (MongoDB)"
              value={grant.userId}
              onChange={(e) => setGrant({ ...grant, userId: e.target.value.trim() })}
            />
            <select
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={grant.planSlug}
              onChange={(e) => setGrant({ ...grant, planSlug: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={grant.billingCycle}
              onChange={(e) => setGrant({ ...grant, billingCycle: e.target.value })}
            >
              {BILLING_CYCLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={grant.status}
              onChange={(e) => setGrant({ ...grant, status: e.target.value })}
            >
              {GRANT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={grantMut.isPending || !grant.userId}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50 lg:col-span-2 lg:w-fit"
            >
              {grantMut.isPending ? "Granting…" : "Grant subscription"}
            </button>
          </form>
          {formError ? <p className="mt-2 text-sm text-rose-300">{formError}</p> : null}
          {customerQuery ? (
            <p className="mt-2 text-xs text-white/40">Selected: {customerQuery}</p>
          ) : null}
      </section>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-white/60">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Period end</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SubscriptionRow
                key={row.id}
                row={row}
                onAction={(action) => setPendingAction({ id: row.id, action })}
              />
            ))}
            {!rows.length && !query.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                  No subscriptions match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-xl border border-white/10 bg-[#1a1a24] p-5">
            <h3 className="text-lg font-semibold capitalize text-white">
              {pendingAction.action} subscription?
            </h3>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm hover:bg-violet-500 disabled:opacity-50"
                disabled={actionMut.isPending}
                onClick={() => actionMut.mutate(pendingAction)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function SubscriptionRow({
  row,
  onAction,
}: {
  row: AdminSubscriptionRow;
  onAction: (action: "suspend" | "unsuspend" | "activate" | "delete") => void;
}) {
  const end = new Date(row.currentPeriodEnd).toLocaleString();
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3">
        <div className="font-medium text-white">
          {row.userDisplayName || row.userEmail || row.userId}
        </div>
        <div className="text-xs text-white/45">
          <Link href={`/admin/customers?q=${encodeURIComponent(row.userEmail)}`} className="hover:underline">
            {row.userEmail}
          </Link>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>{row.plan.name}</div>
        <div className="text-xs text-white/45">
          {formatMediaPlanCents(row.priceCents, row.currency)} / {row.billingCycle}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs capitalize ring-1 ring-inset ${statusClass(row.status)}`}
        >
          {row.status}
          {row.entitled ? " · entitled" : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-white/70">{end}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1">
          {row.status === SubscriptionStatus.Pending ? (
            <ActionBtn label="Activate" onClick={() => onAction("activate")} />
          ) : null}
          {row.status === SubscriptionStatus.Suspended ? (
            <ActionBtn label="Unsuspend" onClick={() => onAction("unsuspend")} />
          ) : (
            <ActionBtn label="Suspend" onClick={() => onAction("suspend")} />
          )}
          <ActionBtn label="Delete" onClick={() => onAction("delete")} danger />
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border px-2 py-1 text-xs ${
        danger
          ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
          : "border-white/15 hover:bg-white/5"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
