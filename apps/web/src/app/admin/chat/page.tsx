"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { ChatIcon } from "@/components/admin/icons";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  getChatAdminOverview,
  getCustomerPanelAdminSettings,
  type ChatAdminOverview,
} from "@/lib/api";

function AdminChatPageContent() {
  const searchParams = useSearchParams();
  const initialRoomId =
    searchParams.get("room")?.trim() ||
    searchParams.get("roomId")?.trim() ||
    undefined;
  const [overview, setOverview] = useState<ChatAdminOverview | null>(null);
  const [allowChatImages, setAllowChatImages] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getChatAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCustomerPanelAdminSettings()
      .then((data) => {
        if (!cancelled) {
          setAllowChatImages(data.chat?.allowImageUpload !== false);
        }
      })
      .catch(() => {
        if (!cancelled) setAllowChatImages(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminPageLayout hideHeader className="admin-chat-page">
      <AdminOrderListCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="Chat rooms"
        className="admin-chat-wrap admin-chat-wrap--fullscreen"
        flatBody
        action={
          <Link href="/admin" className="dashboard-pro-btn-ghost shrink-0">
            ← Dashboard
          </Link>
        }
      >
        <div className="admin-chat-page-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatPanel
            isAdmin
            pro
            fullHeight
            overview={overview}
            initialRoomId={initialRoomId}
            onOverviewChange={setOverview}
            allowChatImages={allowChatImages}
          />
        </div>
      </AdminOrderListCard>
    </AdminPageLayout>
  );
}

export default function AdminChatPage() {
  return (
    <Suspense
      fallback={
        <AdminPageLayout hideHeader loading loadingText="Loading chat…" />
      }
    >
      <AdminChatPageContent />
    </Suspense>
  );
}
