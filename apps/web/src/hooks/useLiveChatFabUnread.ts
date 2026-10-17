"use client";

import { useSyncExternalStore } from "react";
import {
  getLiveChatFabUnread,
  subscribeLiveChatFabUnread,
} from "@/lib/live-chat-fab-unread";

export function useLiveChatFabUnread(): number {
  return useSyncExternalStore(
    subscribeLiveChatFabUnread,
    getLiveChatFabUnread,
    () => 0,
  );
}
