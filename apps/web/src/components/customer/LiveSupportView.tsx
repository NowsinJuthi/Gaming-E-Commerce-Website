"use client";

import { useEffect } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";
import type { ChatRoomStatus } from "@/lib/api";
import { markChatNotificationsRead } from "@/lib/api";

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
  useEffect(() => {
    markChatNotificationsRead("customer")
      .then(() => notifyUnreadCountChanged())
      .catch(() => undefined);
  }, []);

  return (
    <div className="admin-chat-wrap admin-product-form-section min-w-0">
      <ChatPanel embedded onStatusChange={onStatusChange} />
    </div>
  );
}
