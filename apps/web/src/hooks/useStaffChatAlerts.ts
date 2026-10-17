"use client";
import { hasAuthSession } from "@/lib/access-token";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { acquireChatSocket, releaseChatSocket } from "@/lib/chat-socket";
import { isChatStaffRole } from "@/lib/chat-roles";
import { playChatNotificationSound } from "@/lib/chat-notification-sound";
import {
  bumpStaffChatUnread,
  notifyUnreadCountChanged,
} from "@/hooks/useUnreadNotifications";

type ChatIconAlertSide = "customer" | "staff";

/**
 * Keeps the live-chat icon badge in sync while the chat window is closed.
 * `alertOn` is the sender side that should raise the badge.
 */
export function useLiveChatIconAlerts(options: {
  enabled?: boolean;
  alertOn: ChatIconAlertSide;
  chatOpen?: boolean;
  playSound?: boolean;
  bumpUnread?: boolean;
}) {
  const {
    enabled = true,
    alertOn,
    chatOpen = false,
    playSound = false,
    bumpUnread = false,
  } = options;
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const chatOpenRef = useRef(chatOpen);
  const playSoundRef = useRef(playSound);
  const bumpUnreadRef = useRef(bumpUnread);
  const seenMessageIdsRef = useRef(new Set<string>());
  pathnameRef.current = pathname;
  chatOpenRef.current = chatOpen;
  playSoundRef.current = playSound;
  bumpUnreadRef.current = bumpUnread;

  useEffect(() => {
    if (!enabled || !hasAuthSession()) return;

    const socket = acquireChatSocket();
    if (!socket) return;

    const timers = new Set<number>();
    const refreshSoon = () => {
      // In-app chat notifications are upserted after message:new is broadcast.
      for (const delay of [800, 2000, 5000]) {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          notifyUnreadCountChanged();
        }, delay);
        timers.add(timer);
      }
    };

    const onMessage = (msg: { id?: string; senderRole?: string }) => {
      const messageId = msg.id?.trim();
      if (messageId) {
        if (seenMessageIdsRef.current.has(messageId)) return;
        seenMessageIdsRef.current.add(messageId);
        if (seenMessageIdsRef.current.size > 200) {
          const first = seenMessageIdsRef.current.values().next().value;
          if (first) seenMessageIdsRef.current.delete(first);
        }
      }
      const fromStaff = isChatStaffRole(msg.senderRole);
      if (alertOn === "customer" && fromStaff) return;
      if (alertOn === "staff" && !fromStaff) return;
      const path = pathnameRef.current;
      if (path?.startsWith("/admin/chat") || path === "/chat") return;
      if (bumpUnreadRef.current) {
        const bump =
          (alertOn === "staff" && fromStaff) ||
          (alertOn === "customer" && !fromStaff);
        const skipBumpForOpenCustomerChat =
          alertOn === "staff" && chatOpenRef.current;
        if (bump && !skipBumpForOpenCustomerChat) {
          bumpStaffChatUnread();
        }
      }
      if (playSoundRef.current && !chatOpenRef.current) {
        playChatNotificationSound();
      }
      refreshSoon();
    };

    socket.on("message:new", onMessage);

    return () => {
      socket.off("message:new", onMessage);
      for (const timer of timers) window.clearTimeout(timer);
      releaseChatSocket();
    };
  }, [alertOn, enabled]);
}

/** Keeps the admin badge in sync when customers send live chat messages. */
export function useStaffChatAlerts(enabled = true) {
  useLiveChatIconAlerts({ enabled, alertOn: "customer" });
}
