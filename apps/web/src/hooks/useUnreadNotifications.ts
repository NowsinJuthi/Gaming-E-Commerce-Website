"use client";
import { hasAuthSession } from "@/lib/access-token";

import { useCallback, useEffect, useState } from "react";
import {
  getStaffChatUnreadCount,
  getUnreadCount,
  type NotificationAudience,
} from "@/lib/api";

export const NOTIFICATION_CHANGE_EVENT = "notification-change";
export const CHAT_UNREAD_BUMP_EVENT = "chat-unread-bump";

export function bumpStaffChatUnread() {
  window.dispatchEvent(new Event(CHAT_UNREAD_BUMP_EVENT));
}

export function notifyUnreadCountChanged() {
  window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
}

export function useUnreadNotifications(
  enabled = true,
  audience: NotificationAudience = "customer",
  chatOnly = false,
  excludeChat = false,
) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled || !hasAuthSession()) {
      setUnread(0);
      return;
    }
    getUnreadCount(audience, chatOnly, excludeChat)
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [audience, chatOnly, excludeChat, enabled]);

  useEffect(() => {
    refresh();
    window.addEventListener("auth-change", refresh);
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, refresh);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refresh();
    }, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("auth-change", refresh);
      window.removeEventListener(NOTIFICATION_CHANGE_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return unread;
}

/** Unread customer chats for the support icon. One room counts as one. */
export function useStaffChatUnreadCount(enabled: boolean) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled || !hasAuthSession()) {
      setUnread(0);
      return;
    }
    getStaffChatUnreadCount()
      .then((result) => setUnread(result.count))
      .catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    refresh();
    const onBump = () => setUnread((count) => count + 1);
    window.addEventListener("auth-change", refresh);
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, refresh);
    window.addEventListener(CHAT_UNREAD_BUMP_EVENT, onBump);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refresh();
    }, 15_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("auth-change", refresh);
      window.removeEventListener(NOTIFICATION_CHANGE_EVENT, refresh);
      window.removeEventListener(CHAT_UNREAD_BUMP_EVENT, onBump);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return unread;
}
