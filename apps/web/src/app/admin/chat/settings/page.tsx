"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminLicenseFeatureNotice } from "@/components/admin/AdminLicenseFeatureNotice";
import {
  AdminOrderPageIntro,
} from "@/components/admin/admin-order-page-shell";
import { LIVE_CHAT_SETTINGS_QUICK_LINKS } from "@/components/admin/admin-quick-links";
import { SettingsIcon } from "@/components/admin/icons";
import { LiveChatSettingsPanel } from "@/components/admin/live-chat-settings-panel";

export default function AdminLiveChatSettingsPage() {
  return (
    <AdminPageLayout
      section="Support"
      title="Live chat settings"
      description="Configure live chat access, messaging options, and saved replies."
      icon={SettingsIcon}
      backHref="/admin/chat"
      backLabel="Live chat"
    >
      <AdminOrderPageIntro
        icon={<SettingsIcon className="h-4 w-4" />}
        title="Live chat settings"
        subtitle="Messaging, customer access, and saved replies"
        quickLinks={LIVE_CHAT_SETTINGS_QUICK_LINKS}
        quickNavLabel="Support shortcuts"
      />

      <AdminLicenseFeatureNotice path="/admin/chat/settings" />

      <LiveChatSettingsPanel />
    </AdminPageLayout>
  );
}
