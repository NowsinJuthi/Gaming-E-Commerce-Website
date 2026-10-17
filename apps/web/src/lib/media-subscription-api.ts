import type {
  AdminSubscriptionRow,
  BillingCycle,
  PublicPlan,
  PublicSubscription,
  PublicSubscriptionEvent,
  SubscriptionEntitlement,
} from "@/lib/media-subscription-types";
import { API_BASE, authRequest } from "@/lib/api";

const CURRENCY_LOCALE: Record<string, string> = {
  BDT: "en-BD",
  USD: "en-US",
};

export function formatMediaPlanCents(cents: number, currency = "BDT"): string {
  const code = (currency || "BDT").toUpperCase();
  const locale = CURRENCY_LOCALE[code] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(
    cents / 100,
  );
}

export const mediaSubscriptionApi = {
  publicPlans: async (): Promise<PublicPlan[]> => {
    const res = await fetch(`${API_BASE}/media/plans`, { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { plans?: PublicPlan[] };
    return data.plans ?? [];
  },

  me: () =>
    authRequest<{ subscription: PublicSubscription | null; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me",
    ),

  history: () =>
    authRequest<{ events: PublicSubscriptionEvent[] }>("/media/subscriptions/me/history"),

  changes: () =>
    authRequest<{ events: PublicSubscriptionEvent[] }>("/media/subscriptions/me/changes"),

  start: (planSlug: string, billingCycle: BillingCycle) =>
    authRequest<{
      subscription: PublicSubscription;
      paymentRequired: boolean;
      entitlement: SubscriptionEntitlement;
    }>("/media/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug, billingCycle }),
    }),

  change: (planSlug: string, billingCycle: BillingCycle) =>
    authRequest<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/change",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingCycle }),
      },
    ),

  cancel: () =>
    authRequest<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/cancel",
      { method: "POST" },
    ),

  resume: () =>
    authRequest<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/media/subscriptions/me/resume",
      { method: "POST" },
    ),

  adminPlans: () => authRequest<{ plans: PublicPlan[] }>("/admin/media/plans"),

  createPlan: (input: Record<string, unknown>) =>
    authRequest<{ plan: PublicPlan }>("/admin/media/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  updatePlan: (id: string, input: Record<string, unknown>) =>
    authRequest<{ plan: PublicPlan }>(`/admin/media/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  disablePlan: (id: string) =>
    authRequest<{ plan: PublicPlan; message: string }>(`/admin/media/plans/${id}`, {
      method: "DELETE",
    }),

  subscriptions: (query?: { userId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (query?.userId) q.set("userId", query.userId);
    if (query?.status) q.set("status", query.status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return authRequest<{ subscriptions: AdminSubscriptionRow[] }>(
      `/admin/media/subscriptions${suffix}`,
    );
  },

  grantSubscription: (input: {
    userId: string;
    planSlug: string;
    billingCycle: BillingCycle | string;
    status?: string;
  }) =>
    authRequest<{ subscription: PublicSubscription }>("/admin/media/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  patchSubscription: (id: string, input: Record<string, unknown>) =>
    authRequest<{ subscription: PublicSubscription }>(`/admin/media/subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  activateSubscription: (id: string) =>
    authRequest<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/activate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    ),

  suspendSubscription: (id: string, reason?: string) =>
    authRequest<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/suspend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    ),

  unsuspendSubscription: (id: string) =>
    authRequest<{ subscription: PublicSubscription }>(
      `/admin/media/subscriptions/${id}/unsuspend`,
      { method: "POST" },
    ),

  deleteSubscription: (id: string) =>
    authRequest<{ message: string; id: string; userId: string }>(
      `/admin/media/subscriptions/${id}`,
      { method: "DELETE" },
    ),
};
