"use client";

import { useEffect, useRef, useState } from "react";
import { getChatStaffQuickReplies, type ChatQuickReply } from "@/lib/api";

export function useStaffQuickReplies(enabled: boolean): ChatQuickReply[] {
  const [replies, setReplies] = useState<ChatQuickReply[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    let cancelled = false;
    getChatStaffQuickReplies()
      .then((result) => {
        if (!cancelled) {
          setReplies(result.quickReplies ?? []);
          loadedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setReplies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return replies;
}
