"use client";

import Link from "next/link";
import {
  AdminOrderListCard,
  AdminOrderStatField,
  AdminOrderStatsGrid,
} from "@/components/admin/admin-order-page-shell";
import {
  BellIcon,
  LockIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/admin/icons";
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/lib/account-settings-tabs";

type SectionProps = {
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  /** Add top divider when embedded in the profile card. */
  embedded?: boolean;
  /** Hide "Public profile" when already on the profile page. */
  hidePublicProfileLink?: boolean;
  className?: string;
};

export function SettingsOverviewSection({
  activeTab,
  onTabChange,
  embedded = false,
  hidePublicProfileLink = false,
  className = "",
}: SectionProps) {
  const statsClassName = embedded
    ? "customer-profile-stats-grid customer-profile-settings-stats"
    : "";

  return (
    <div className={className}>
      <AdminOrderStatsGrid className={statsClassName}>
        <AdminOrderStatField
          icon={<UserIcon className="h-4 w-4" />}
          label="Profile"
          value="Identity"
          meta="Name, photo, contact"
        />
        <AdminOrderStatField
          icon={<LockIcon className="h-4 w-4" />}
          label="Security"
          value="Access"
          meta="Password & sessions"
        />
        <AdminOrderStatField
          icon={<BellIcon className="h-4 w-4" />}
          label="Alerts"
          value="Channels"
          meta="Notification preferences"
        />
        <AdminOrderStatField
          icon={<ShieldIcon className="h-4 w-4" />}
          label="KYC"
          value="Verify"
          meta="Identity documents"
        />
      </AdminOrderStatsGrid>

      <div
        className={
          embedded
            ? "customer-profile-sections-block customer-profile-sections-block--embedded"
            : "admin-order-view-detail-row admin-order-view-detail-row--stacked customer-profile-sections-row"
        }
      >
        {embedded ? (
          <p className="customer-profile-sections-label">Sections</p>
        ) : (
          <dt>Sections</dt>
        )}
        {embedded ? (
          <div
            className="customer-profile-section-tabs"
            role="tablist"
            aria-label="Account settings sections"
          >
            {SETTINGS_TABS.map((t) =>
              onTabChange ? (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => onTabChange(t.id)}
                  className={`admin-notifications-tab${
                    activeTab === t.id ? " admin-notifications-tab--active" : ""
                  }`}
                >
                  {t.label}
                </button>
              ) : (
                <Link
                  key={t.id}
                  href={`/profile?tab=${t.id}`}
                  role="tab"
                  className="admin-notifications-tab"
                >
                  {t.label}
                </Link>
              ),
            )}
          </div>
        ) : (
          <dd>
            <div
              className="admin-notifications-tabs customer-profile-section-tabs"
              role="tablist"
            >
              {SETTINGS_TABS.map((t) =>
                onTabChange ? (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => onTabChange(t.id)}
                    className={`admin-notifications-tab${
                      activeTab === t.id ? " admin-notifications-tab--active" : ""
                    }`}
                  >
                    {t.label}
                  </button>
                ) : (
                  <Link
                    key={t.id}
                    href={`/profile?tab=${t.id}`}
                    role="tab"
                    className="admin-notifications-tab"
                  >
                    {t.label}
                  </Link>
                ),
              )}
            </div>
          </dd>
        )}
      </div>

      {hidePublicProfileLink ? null : (
        <div className="customer-profile-action-row">
          <Link href="/profile" className="dashboard-pro-btn-ghost text-xs">
            Public profile
          </Link>
        </div>
      )}
    </div>
  );
}

type CardProps = SectionProps & {
  className?: string;
};

export function SettingsOverviewCard({
  activeTab,
  onTabChange,
  className = "customer-orders-overview-card",
  hidePublicProfileLink = false,
}: CardProps) {
  const active =
    SETTINGS_TABS.find((t) => t.id === activeTab) ?? SETTINGS_TABS[0];
  const subtitle = activeTab
    ? `${SETTINGS_TABS.length} sections · currently viewing ${active?.label ?? "settings"}`
    : `${SETTINGS_TABS.length} sections · profile, security, alerts, and verification`;

  return (
    <AdminOrderListCard
      icon={<SettingsIcon className="h-4 w-4" />}
      title="Settings overview"
      subtitle={subtitle}
      className={className}
    >
      <SettingsOverviewSection
        activeTab={activeTab}
        onTabChange={onTabChange}
        hidePublicProfileLink={hidePublicProfileLink}
      />
    </AdminOrderListCard>
  );
}
