import type {
  AdminSubscriptionRow,
  BillingCycle,
  PublicPlan,
  PublicSubscription,
  PublicSubscriptionEvent,
  SubscriptionEntitlement,
} from "@/lib/media-subscription-types";
import { API_BASE, authRequestAtBase } from "@/lib/api";

const CURRENCY_LOCALE: Record<string, string> = {
  BDT: "en-BD",
  USD: "en-US",
};

/**
 * Movie subscription calls use the storefront origin `/api/*` proxy in the browser so
 * admin plans work even when NEXT_PUBLIC_API_URL points at a host without Nest routes.
 */
function mediaSubscriptionApiBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  }
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  return API_BASE.replace(/\/$/, "");
}

function mediaAuth<T>(path: string, init?: RequestInit): Promise<T> {
  return authRequestAtBase<T>(mediaSubscriptionApiBase(), path, init);
}

export function formatMediaPlanCents(cents: number, currency = "BDT"): string {
  const code = (currency || "BDT").toUpperCase();
  const locale = CURRENCY_LOCALE[code] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(
    cents / 100,
  );
}

export const mediaSubscriptionApi = {
  publicPlans: async (): Promise<PublicPlan[]> => {
    const base = mediaSubscriptionApiBase();
    const res = await fetch(`${base}/media/plans`, { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { plans?: PublicPlan[] };
    return data.plans ?? [];
  },

  me: () =>
    mediaAuth<{ subscription: PublicSubscription | null; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me",
    ),

  history: () => mediaAuth<{ events: PublicSubscriptionEvent[] }>("/media/subscriptions/me/history"),

  changes: () =>
    mediaAuth<{ events: PublicSubscriptionEvent[] }>("/media/subscriptions/me/changes"),

  start: (planSlug: string, billingCycle: BillingCycle) =>
    mediaAuth<{
      subscription: PublicSubscription;
      paymentRequired: boolean;
      entitlement: SubscriptionEntitlement;
    }>("/media/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug, billingCycle }),
    }),

  change: (planSlug: string, billingCycle: BillingCycle) =>
    mediaAuth<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/change",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingCycle }),
      },
    ),

  cancel: () =>
    mediaAuth<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/cancel",
      { method: "POST" },
    ),

  resume: () =>
    mediaAuth<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/resume",
      { method: "POST" },
    ),

  adminPlans: () => mediaAuth<{ plans: PublicPlan[] }>("/admin/media/plans"),

  createPlan: (input: Record<string, unknown>) =>
    mediaAuth<{ plan: PublicPlan }>("/admin/media/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  updatePlan: (id: string, input: Record<string, unknown>) =>
    mediaAuth<{ plan: PublicPlan }>(`/admin/media/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  disablePlan: (id: string) =>
    mediaAuth<{ plan: PublicPlan; message: string }>(`/admin/media/plans/${id}`, {
      method: "DELETE",
    }),

  subscriptions: (query?: { userId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (query?.userId) q.set("userId", query.userId);
    if (query?.status) q.set("status", query.status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return mediaAuth<{ subscriptions: AdminSubscriptionRow[] }>(
      `/admin/media/subscriptions${suffix}`,
    );
  },

  grantSubscription: (input: {
    userId: string;
    planSlug: string;
    billingCycle: BillingCycle | string;
    status?: string;
  }) =>
    mediaAuth<{ subscription: PublicSubscription }>("/admin/media/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  patchSubscription: (id: string, input: Record<string, unknown>) =>
    mediaAuth<{ subscription: PublicSubscription }>(`/admin/media/subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  activateSubscription: (id: string) =>
    mediaAuth<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/activate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    ),

  suspendSubscription: (id: string, reason?: string) =>
    mediaAuth<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/suspend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    ),

  unsuspendSubscription: (id: string) =>
    mediaAuth<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/unsuspend`,
      { method: "POST" },
    ),

  deleteSubscription: (id: string) =>
    mediaAuth<{ message: string; id: string; userId: string }>(
      `/admin/media/subscriptions/${id}`,
      { method: "DELETE" },
    ),
};
