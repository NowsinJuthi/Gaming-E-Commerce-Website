"use client";

import { useEffect, useRef } from "react";
import {
  getMe,
  getStaffChatUnreadCount,
  getUnreadCount,
} from "@/lib/api";
import { hasAuthSession, getSessionRoles } from "@/lib/access-token";
import { isChatStaffFromRoles, isChatStaffRole } from "@/lib/chat-roles";
import { canAccessLiveChat } from "@/lib/chat-access";
import type { Socket } from "socket.io-client";
import { acquireChatSocket, releaseChatSocket } from "@/lib/chat-socket";
import { playChatNotificationSound } from "@/lib/chat-notification-sound";
import {
  bumpLiveChatFabUnread,
  resetLiveChatFabUnread,
  syncLiveChatFabUnread,
} from "@/lib/live-chat-fab-unread";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";

type FabRole = "guest" | "customer" | "staff";

function resolveFabRole(): FabRole {
  if (typeof window === "undefined" || !hasAuthSession()) return "guest";
  if (isChatStaffFromRoles(getSessionRoles())) return "staff";
  return "customer";
}

/**
 * One tab-wide sync for the live-chat FAB badge: socket message:new, REST fallback,
 * and auth/role changes. Mounted once from ChromeShell.
 */
export function LiveChatFabSync({
  allowGuestChat = false,
}: {
  allowGuestChat?: boolean;
}) {
  const roleRef = useRef<FabRole>("guest");
  const chatAllowedRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let socket: Socket | null = null;
    const refreshTimers = new Set<number>();

    const chatAllowed = () => canAccessLiveChat(allowGuestChat);
    chatAllowedRef.current = chatAllowed();

    const setRole = (role: FabRole) => {
      roleRef.current = role;
    };

    const pullFromServer = async (exact = false) => {
      if (cancelled || !hasAuthSession() || !chatAllowed()) {
        resetLiveChatFabUnread();
        return;
      }
      const role = roleRef.current;
      try {
        if (role === "staff") {
          const { count } = await getStaffChatUnreadCount();
          if (!cancelled) syncLiveChatFabUnread(count, exact);
        } else if (role === "customer") {
          const { count } = await getUnreadCount("customer", true);
          if (!cancelled) syncLiveChatFabUnread(count, exact);
        }
      } catch {
        /* keep optimistic count */
      }
    };

    const scheduleRefresh = () => {
      for (const delay of [600, 1500, 4000, 9000]) {
        const id = window.setTimeout(() => {
          refreshTimers.delete(id);
          void pullFromServer(false);
        }, delay);
        refreshTimers.add(id);
      }
      notifyUnreadCountChanged();
    };

    const onMessage = (msg: {
      id?: string;
      senderRole?: string;
      senderId?: string;
    }) => {
      if (!chatAllowedRef.current || roleRef.current === "guest") return;

      const messageId = msg.id?.trim();
      if (messageId) {
        if (seenIdsRef.current.has(messageId)) return;
        seenIdsRef.current.add(messageId);
        if (seenIdsRef.current.size > 300) {
          const first = seenIdsRef.current.values().next().value;
          if (first) seenIdsRef.current.delete(first);
        }
      }

      const fromStaff = isChatStaffRole(msg.senderRole);
      const role = roleRef.current;
      const relevant =
        (role === "customer" && fromStaff) ||
        (role === "staff" && !fromStaff);
      if (!relevant) return;

      bumpLiveChatFabUnread();
      playChatNotificationSound();
      scheduleRefresh();
    };

    const attachSocket = () => {
      if (socket || !hasAuthSession() || !chatAllowed()) return;
      socket = acquireChatSocket();
      if (!socket) return;
      socket.on("message:new", onMessage);
    };

    const bootstrap = async () => {
      chatAllowedRef.current = chatAllowed();
      setRole(resolveFabRole());
      if (!hasAuthSession()) {
        resetLiveChatFabUnread();
        return;
      }
      try {
        const me = await getMe();
        if (cancelled) return;
        setRole(isChatStaffFromRoles(me.roles ?? []) ? "staff" : "customer");
      } catch {
        setRole(resolveFabRole());
      }
      await pullFromServer(true);
      attachSocket();
    };

    void bootstrap();

    const onAuthChange = () => {
      chatAllowedRef.current = chatAllowed();
      setRole(resolveFabRole());
      if (!hasAuthSession()) {
        resetLiveChatFabUnread();
        return;
      }
      void getMe()
        .then((me) => {
          if (cancelled) return;
          setRole(isChatStaffFromRoles(me.roles ?? []) ? "staff" : "customer");
          void pullFromServer(true);
        })
        .catch(() => undefined);
      attachSocket();
    };

    const onNotificationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ exact?: boolean }>).detail;
      void pullFromServer(detail?.exact === true);
    };

    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("notification-change", onNotificationChange);

    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void pullFromServer(false);
    }, 8_000);

    const onVisibility = () => {
      if (!document.hidden) void pullFromServer(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("notification-change", onNotificationChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (pollTimer !== null) window.clearInterval(pollTimer);
      for (const id of refreshTimers) window.clearTimeout(id);
      refreshTimers.clear();
      if (socket) {
        socket.off("message:new", onMessage);
        releaseChatSocket();
        socket = null;
      }
    };
  }, [allowGuestChat]);

  return null;
}
