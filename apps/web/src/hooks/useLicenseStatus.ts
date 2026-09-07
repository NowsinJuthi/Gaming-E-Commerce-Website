"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLicenseAdminStatus,
  type LicenseAdminStatus,
} from "@/lib/api";

let cachedStatus: LicenseAdminStatus | null = null;
let inflight: Promise<LicenseAdminStatus> | null = null;

function dispatchLicenseUpdated(status: LicenseAdminStatus) {
  try {
    window.dispatchEvent(
      new CustomEvent("license-updated", {
        detail: { valid: status.valid === true, devBypass: status.devBypass === true },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function useLicenseStatus(refreshKey = 0) {
  const [status, setStatus] = useState<LicenseAdminStatus | null>(cachedStatus);
  const [loading, setLoading] = useState(!cachedStatus);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!inflight) {
        inflight = getLicenseAdminStatus().finally(() => {
          inflight = null;
        });
      }
      const next = await inflight;
      cachedStatus = next;
      setStatus(next);
      dispatchLicenseUpdated(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load license");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void reload();
    }, 15_000);
    const onVis = () => {
      if (!document.hidden) void reload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  return { status, loading, error, reload };
}

export function invalidateLicenseStatusCache(): void {
  cachedStatus = null;
}
