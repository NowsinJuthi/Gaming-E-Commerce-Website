"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { PulseIcon } from "@/components/admin/icons";
import { LiveChatSystemStatusPanel } from "@/components/admin/live-chat-system-status-panel";

export default function AdminLiveChatStatusPage() {
  return (
    <AdminPageLayout
      section="Support"
      title="System status"
      description="Live chat room counts, message volume, and transport health."
      icon={PulseIcon}
      backHref="/admin/chat/settings"
      backLabel="Live chat settings"
    >
      <LiveChatSystemStatusPanel />
    </AdminPageLayout>
  );
}
