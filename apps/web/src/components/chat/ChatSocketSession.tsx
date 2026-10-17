"use client";

import { useEffect, useRef } from "react";
import { hasAuthSession } from "@/lib/access-token";
import { acquireChatSocket, releaseChatSocket } from "@/lib/chat-socket";

/**
 * Keeps one authenticated /chat socket alive for the tab so live-chat badge
 * listeners receive message:new before the chat panel is opened.
 */
export function ChatSocketSession() {
  const holdingRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      if (hasAuthSession()) {
        if (!holdingRef.current) {
          acquireChatSocket();
          holdingRef.current = true;
        }
      } else if (holdingRef.current) {
        releaseChatSocket();
        holdingRef.current = false;
      }
    };

    sync();
    window.addEventListener("auth-change", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      if (holdingRef.current) {
        releaseChatSocket();
        holdingRef.current = false;
      }
    };
  }, []);

  return null;
}
