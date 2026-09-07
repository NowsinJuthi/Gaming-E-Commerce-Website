"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isChatNotificationSoundEnabled,
  setChatNotificationSoundEnabled,
} from "@/lib/chat-notification-sound";

export function useChatNotificationSound() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isChatNotificationSoundEnabled());

    function onChange(event: Event) {
      const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setEnabled(detail.enabled);
      } else {
        setEnabled(isChatNotificationSoundEnabled());
      }
    }

    window.addEventListener("chat-notification-sound-change", onChange);
    return () =>
      window.removeEventListener("chat-notification-sound-change", onChange);
  }, []);

  const toggle = useCallback(() => {
    const next = !isChatNotificationSoundEnabled();
    setChatNotificationSoundEnabled(next);
    setEnabled(next);
  }, []);

  const setSoundEnabled = useCallback((next: boolean) => {
    setChatNotificationSoundEnabled(next);
    setEnabled(next);
  }, []);

  return { soundEnabled: enabled, toggleSound: toggle, setSoundEnabled };
}
