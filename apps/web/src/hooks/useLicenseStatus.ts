"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLicenseAdminStatus,
  type LicenseAdminStatus,
} from "@/lib/api";

let cachedStatus: LicenseAdminStatus | null = null;
let inflight: Promise<LicenseAdminStatus> | null = null;

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

  return { status, loading, error, reload };
}

export function invalidateLicenseStatusCache(): void {
  cachedStatus = null;
}
