import type {
  AdminSubscriptionRow,
  BillingCycle,
  PublicPlan,
  PublicSubscription,
} from "@/lib/media-subscription-types";
import { authRequest } from "@/lib/api";

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
