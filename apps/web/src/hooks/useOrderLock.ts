"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireOrderLock,
  refreshOrderLock,
  releaseOrderLock,
  type OrderLockInfo,
} from "@/lib/api";

/** How long between heartbeat calls to keep the lock alive (ms). */
const HEARTBEAT_MS = 90_000;

export type LockState =
  | { status: "loading" }
  | { status: "acquired" }
  | { status: "blocked"; lock: OrderLockInfo }
  | { status: "error"; message: string };

interface UseOrderLockOptions {
  /** Display name of the current admin user (for the lock record). */
  userName: string;
  /** Set to false to skip acquiring (e.g. on the list page). */
  enabled?: boolean;
}

/**
 * Manages an edit lock for an order detail page.
 *
 * - Acquires the lock on mount.
 * - Keeps it alive via a heartbeat every 90 seconds.
 * - Releases it on unmount (best-effort via sendBeacon).
 * - Returns `lockState` so the page can block editing or show a warning.
 * - `forceOverride` lets a user force-take the lock from another salesperson.
 */
export function useOrderLock(
  orderId: string,
  { userName, enabled = true }: UseOrderLockOptions,
) {
  const [lockState, setLockState] = useState<LockState>({ status: "loading" });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acquiredRef = useRef(false);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      const still = await refreshOrderLock(orderIdRef.current).catch(() => false);
      if (!still) {
        // Lock expired or was stolen — reflect this to the user.
        setLockState({ status: "error", message: "Lock expired. Reload to re-acquire." });
        stopHeartbeat();
      }
    }, HEARTBEAT_MS);
  }, [stopHeartbeat]);

  const acquire = useCallback(
    async (force = false) => {
      if (!enabled || !orderId) return;
      setLockState({ status: "loading" });
      try {
        const result = await acquireOrderLock(orderId, userName);
        if (result.acquired) {
          acquiredRef.current = true;
          setLockState({ status: "acquired" });
          startHeartbeat();
        } else if (force) {
          // Re-try once: the other holder may have just been force-released
          const retry = await acquireOrderLock(orderId, userName);
          if (retry.acquired) {
            acquiredRef.current = true;
            setLockState({ status: "acquired" });
            startHeartbeat();
          } else {
            setLockState({
              status: "blocked",
              lock: retry.lock ?? result.lock!,
            });
          }
        } else {
          setLockState({ status: "blocked", lock: result.lock! });
        }
      } catch {
        setLockState({ status: "error", message: "Could not check order lock." });
      }
    },
    [enabled, orderId, userName, startHeartbeat],
  );

  useEffect(() => {
    if (!enabled || !orderId) return;

    void acquire();

    return () => {
      stopHeartbeat();
      if (acquiredRef.current) {
        acquiredRef.current = false;
        // Best-effort release: use sendBeacon so it fires even on tab close.
        const url = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/orders/${orderIdRef.current}/lock`;
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;
        if (token) {
          // sendBeacon does not support custom headers, so use fetch with
          // keepalive for the token-authenticated DELETE.
          void fetch(url, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
          }).catch(() => {});
        } else {
          void releaseOrderLock(orderIdRef.current).catch(() => {});
        }
      }
    };
  }, [orderId, enabled, acquire, stopHeartbeat]);

  /** Force-take the lock from the current holder (with user confirmation). */
  const forceOverride = useCallback(() => {
    void acquire(true);
  }, [acquire]);

  return { lockState, forceOverride };
}
