"use client";

import { DevicesSection } from "@/components/account/DevicesSection";
import { KycSection } from "@/components/account/KycSection";
import { NotificationsSection } from "@/components/account/NotificationsSection";
import { AppearanceSection } from "@/components/account/AppearanceSection";
import { PasswordSection } from "@/components/account/PasswordSection";
import { ProfileSection } from "@/components/account/ProfileSection";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { SettingsOverviewCard } from "@/components/customer/SettingsOverviewCard";
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/lib/account-settings-tabs";

export type { SettingsTab } from "@/lib/account-settings-tabs";
export { SETTINGS_TABS } from "@/lib/account-settings-tabs";

type Props = {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
};

export function renderSettingsSection(
  tab: SettingsTab,
  options?: { embedded?: boolean },
) {
  const embedded = options?.embedded ?? false;
  switch (tab) {
    case "profile":
      return <ProfileSection embedded={embedded} />;
    case "security":
      return <PasswordSection embedded={embedded} />;
    case "appearance":
      return <AppearanceSection embedded={embedded} />;
    case "devices":
      return <DevicesSection embedded={embedded} />;
    case "notifications":
      return <NotificationsSection embedded={embedded} />;
    case "kyc":
      return <KycSection embedded={embedded} />;
    default:
      return null;
  }
}

export function AccountSettingsView({ tab, onTabChange }: Props) {
  const active = SETTINGS_TABS.find((t) => t.id === tab) ?? SETTINGS_TABS[0];
  if (!active) return null;

  return (
    <div className="customer-settings-page space-y-5">
      <SettingsOverviewCard activeTab={tab} onTabChange={onTabChange} />

      <AdminOrderListCard
        icon={active.icon}
        title={active.title}
        subtitle={active.subtitle}
        className="admin-product-form-section"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>{active.label}</dt>
          <dd className="min-w-0">{renderSettingsSection(tab)}</dd>
        </div>
      </AdminOrderListCard>
    </div>
  );
}
