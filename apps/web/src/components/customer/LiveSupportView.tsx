"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";
import { getMe, markChatNotificationsRead, type ChatRoomStatus } from "@/lib/api";
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
  const [staffView, setStaffView] = useState<boolean | null>(null);

  useEffect(() => {
    markChatNotificationsRead("customer")
      .then(() => notifyUnreadCountChanged())
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) {
          setStaffView(isChatStaffFromRoles(me.roles ?? []));
        }
      })
      .catch(() => {
        if (!cancelled) setStaffView(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (staffView === null) {
    return (
      <div className="admin-chat-wrap admin-product-form-section min-w-0 p-8 text-center text-sm text-subtle">
        Loading live chat…
      </div>
    );
  }

  return (
    <div className="admin-chat-wrap admin-product-form-section min-w-0">
      {staffView ? (
        <ChatPanel isAdmin pro embedded fullHeight onStatusChange={onStatusChange} />
      ) : (
        <ChatPanel embedded onStatusChange={onStatusChange} />
      )}
    </div>
  );
}
