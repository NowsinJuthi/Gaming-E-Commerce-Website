"use client";

import Link from "next/link";
import type { OrderDetail, UserProfile } from "@/lib/api";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type Props = {
  profile: UserProfile;
  orders: OrderDetail[];
};

export function DashboardUnifiedHeader({ profile, orders }: Props) {
  const name =
    profile.profile?.firstName ?? profile.email?.split("@")[0] ?? "there";
  const avatarUrl = profile.profile?.avatarUrl ?? "";
  const resolvedAvatar = avatarUrl ? resolveAvatarSrc(avatarUrl) : "";
  const avatarInitial = name.charAt(0).toUpperCase();
  const pendingCount = orders.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "processing" ||
      o.status === "paid",
  ).length;

  return (
    <article className="customer-dashboard-unified-header-card customer-dashboard-mobile-header-card">
      <div className="customer-dashboard-mobile-header-glow" aria-hidden />

      <section className="customer-dashboard-mobile-header-main">
        <div className="customer-dashboard-mobile-header-welcome-row">
          <span
            className={`customer-dashboard-mobile-header-avatar${
              resolvedAvatar
                ? " customer-dashboard-mobile-header-avatar--photo"
                : ""
            }`}
            aria-hidden={!resolvedAvatar}
          >
            {resolvedAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedAvatar}
                alt={`${name} profile photo`}
                className="customer-dashboard-mobile-header-avatar-img"
              />
            ) : (
              avatarInitial
            )}
          </span>          <div className="min-w-0 flex-1">
            <h1
              id="customer-dashboard-overview-title"
              className="customer-dashboard-unified-header-title"
            >
              My Dashboard
            </h1>
            <p className="customer-dashboard-mobile-welcome-sub">
              Welcome, {name} · {profile.email}
            </p>
          </div>
        </div>
      </section>

      <section
        className="customer-dashboard-mobile-header-actions"
        aria-label="Quick status and navigation"
      >
        <Link
          href="/products"
          className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--store"
        >
          ← Store
        </Link>
        <span
          className={`customer-dashboard-mobile-chip ${
            profile.emailVerified
              ? "customer-dashboard-mobile-chip--green"
              : "customer-dashboard-mobile-chip--amber"
          }`}
        >
          {profile.emailVerified ? "Email verified" : "Email not verified"}
        </span>
        <span className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--brand capitalize">
          {profile.status ?? "active"} account
        </span>
        {pendingCount > 0 ? (
          <span className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--amber">
            {pendingCount} in progress
          </span>
        ) : null}
      </section>
    </article>
  );
}
