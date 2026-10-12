"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";
import { getSessionRoles, hasAuthSession } from "@/lib/access-token";
import type { ChatRoomStatus } from "@/lib/api";
import { markChatNotificationsRead } from "@/lib/api";
import { isChatStaffFromRoles } from "@/lib/chat-roles";

export type LiveSupportStatus = {
  connected: boolean;
  onlineCount: number;
  roomStatus: ChatRoomStatus | null;
  loading: boolean;
};

type Props = {
  onStatusChange?: (status: LiveSupportStatus) => void;
};

export function LiveSupportView({ onStatusChange }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"checking" | "customer" | "staff">(
    "checking",
  );

  useEffect(() => {
    markChatNotificationsRead("customer")
      .then(() => notifyUnreadCountChanged())
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hasAuthSession()) {
      setView("customer");
      return;
    }
    if (isChatStaffFromRoles(getSessionRoles())) {
      setView("staff");
      router.replace("/admin/chat");
      return;
    }
    setView("customer");
  }, [router]);

  if (view === "checking" || view === "staff") {
    return (
      <div className="admin-chat-wrap admin-product-form-section min-w-0 p-8 text-center text-sm text-subtle">
        {view === "staff" ? (
          <p>
            Redirecting to{" "}
            <Link href="/admin/chat" className="text-brand underline">
              Admin Live Chat
            </Link>
            …
          </p>
        ) : (
          <p>Loading live chat…</p>
        )}
      </div>
    );
  }

  return (
    <div className="admin-chat-wrap admin-product-form-section min-w-0">
      <ChatPanel embedded onStatusChange={onStatusChange} />
    </div>
  );
}
