"use client";

import { AdminOrderPageIntro } from "@/components/admin/admin-order-page-shell";
import { GridIcon } from "@/components/admin/icons";
import type { OrderDetail, UserProfile } from "@/lib/api";
import { DASHBOARD_QUICK_LINKS } from "@/lib/customer-quick-links";

type Props = {
  profile: UserProfile;
  orders: OrderDetail[];
  visibility?: "all" | "mobile-only" | "desktop-only";
};

export function DashboardWelcomeIntro({
  profile,
  orders,
  visibility = "all",
}: Props) {
  const name =
    profile.profile?.firstName ?? profile.email?.split("@")[0] ?? "there";
  const pendingCount = orders.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "processing" ||
      o.status === "paid",
  ).length;
  const introSubtitle = profile.emailVerified
    ? `${profile.email} · ${pendingCount > 0 ? `${pendingCount} order${pendingCount === 1 ? "" : "s"} in progress` : "All caught up"}`
    : `${profile.email} · Verify your email to secure your account`;

  const visibilityClass =
    visibility === "mobile-only"
      ? "lg:hidden"
      : visibility === "desktop-only"
        ? "max-lg:hidden"
        : "";

  return (
    <div className={visibilityClass}>
      <AdminOrderPageIntro
        className="customer-dashboard-welcome-intro"
        icon={<GridIcon className="h-4 w-4" />}
        title={`Welcome, ${name}`}
        subtitle={introSubtitle}
        quickLinks={DASHBOARD_QUICK_LINKS}
        quickNavLabel="Quick actions"
      />
    </div>
  );
}
