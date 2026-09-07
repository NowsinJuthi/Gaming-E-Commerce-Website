"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { acquireChatSocket, releaseChatSocket } from "@/lib/chat-socket";
import { isChatStaffRole } from "@/lib/chat-roles";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";

/** Keeps admin bell badge in sync when customers send live chat messages. */
export function useStaffChatAlerts(enabled = true) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const socket = acquireChatSocket();
    if (!socket) return;

    const onMessage = (msg: { senderRole?: string }) => {
      if (isChatStaffRole(msg.senderRole)) return;
      if (pathnameRef.current?.startsWith("/admin/chat")) return;
      window.setTimeout(() => notifyUnreadCountChanged(), 350);
    };

    socket.on("message:new", onMessage);

    return () => {
      socket.off("message:new", onMessage);
      releaseChatSocket();
    };
  }, [enabled]);
}
