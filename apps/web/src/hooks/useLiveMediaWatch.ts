"use client";

import { useEffect, useRef } from "react";
import { getLiveAnalyticsSocket } from "@/lib/live-analytics-socket";
import { getVisitorKey } from "@/lib/visitor-key";

export function useLiveMediaWatch(input: {
  active: boolean;
  titleId: string;
  titleName: string;
  episodeName?: string | null;
}) {
  const payloadRef = useRef(input);
  payloadRef.current = input;

  useEffect(() => {
    if (!input.active || !input.titleId.trim()) return;

    const visitorKey = getVisitorKey();
    if (!visitorKey) return;

    const socket = getLiveAnalyticsSocket();

    const send = () => {
      const current = payloadRef.current;
      if (!current.active || !current.titleId.trim()) return;
      socket.emit("media:watching", {
        visitorKey,
        titleId: current.titleId,
        titleName: current.titleName,
        episodeName: current.episodeName ?? undefined,
      });
    };

    send();
    const id = window.setInterval(send, 25_000);
    socket.on("connect", send);

    return () => {
      window.clearInterval(id);
      socket.off("connect", send);
      socket.emit("media:idle", { visitorKey });
    };
  }, [input.active, input.titleId, input.titleName, input.episodeName]);
}
