"use client";

import Link from "next/link";
import {
  ProfileSection,
} from "@/components/account/ProfileSection";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import {
  GridIcon,
  UserIcon,
} from "@/components/admin/icons";
import { renderSettingsSection } from "@/components/customer/AccountSettingsView";
import { CustomerOrdersOverviewCard } from "@/components/customer/CustomerOrdersOverviewCard";
import { SettingsOverviewSection } from "@/components/customer/SettingsOverviewCard";
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/lib/account-settings-tabs";
import type {
  CustomerOrderStats,
  OrderDetail,
  UserProfile,
  Wallet,
} from "@/lib/api";

type Props = {
  profile: UserProfile | null;
  wallet: Wallet | null;
  orders: OrderDetail[];
  orderStats: CustomerOrderStats | null;
  loading: boolean;
  loadError: string | null;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
};

function AccountOverviewStats({
  profile,
  wallet,
  orders,
  orderStats,
  loading,
}: {
  profile: UserProfile | null;
  wallet: Wallet | null;
  orders: OrderDetail[];
  orderStats: CustomerOrderStats | null;
  loading: boolean;
}) {
  if (loading || !profile) {
    return (
      <section className="customer-dashboard-overview-section customer-profile-overview-stats">
        <dl className="customer-dashboard-overview-stats">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={`profile-overview-skeleton-${index}`}
              className="customer-dashboard-overview-stat h-[5.25rem] animate-pulse bg-white/[0.03]"
            />
          ))}
        </dl>
      </section>
    );
  }

  return (
    <CustomerOrdersOverviewCard
      profile={profile}
      wallet={wallet}
      orders={orders}
      totalOrders={orderStats?.totalOrders}
      totalSpent={orderStats?.totalSpent}
      currency={orderStats?.currency}
    />
  );
}

export function ProfileView({
  profile,
  wallet,
  orders,
  orderStats,
  loading,
  loadError,
  tab,
  onTabChange,
}: Props) {
  const active = SETTINGS_TABS.find((t) => t.id === tab) ?? SETTINGS_TABS[0];
  if (!active) return null;

  if (loadError) {
    return (
      <AdminOrderListCard
        icon={<UserIcon className="h-4 w-4" />}
        title="Profile"
        subtitle="Could not load profile"
        className="customer-profile-card"
      >
        <div className="dashboard-pro-empty py-8">
          <span className="dashboard-pro-empty-icon" aria-hidden>
            <GridIcon className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-foreground">{loadError}</p>
          <p className="mt-1 text-xs text-subtle">
            Try refreshing the page or contact support if the problem continues.
          </p>
          <div className="customer-profile-action-row mt-4">
            <Link href="/chat" className="dashboard-pro-btn">
              Contact support
            </Link>
            <Link href="/dashboard" className="dashboard-pro-btn-ghost">
              ← Dashboard
            </Link>
          </div>
        </div>
      </AdminOrderListCard>
    );
  }

  return (
    <div className="customer-profile-page space-y-3 sm:space-y-4">
      <AdminOrderListCard
        icon={<GridIcon className="h-4 w-4" />}
        title="Account overview"
        subtitle={
          loading
            ? "Loading account details…"
            : "Your profile, security, and notification settings"
        }
        className="customer-profile-card customer-profile-overview-card"
        flatBody
      >
        <AccountOverviewStats
          profile={profile}
          wallet={wallet}
          orders={orders}
          orderStats={orderStats}
          loading={loading}
        />

        <SettingsOverviewSection
          embedded
          hidePublicProfileLink
          activeTab={tab}
          onTabChange={onTabChange}
          className="customer-profile-settings-section"
        />
      </AdminOrderListCard>

      {tab === "profile" ? (
        <AdminOrderListCard
          icon={<UserIcon className="h-4 w-4" />}
          title="Edit profile"
          subtitle="Photo, name, contact details, and bio"
          className="customer-profile-card customer-profile-edit-card"
          flatBody
        >
          <ProfileSection
            embedded
            providedProfile={profile}
            providedLoading={loading}
          />
        </AdminOrderListCard>
      ) : (
        <AdminOrderListCard
          icon={active.icon}
          title={active.title}
          subtitle={active.subtitle}
          className="customer-profile-card customer-profile-edit-card"
          flatBody
        >
          {renderSettingsSection(tab, { embedded: true })}
        </AdminOrderListCard>
      )}
    </div>
  );
}
