"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "uniqbd-build-id";
const POLL_MS = 60_000;

/**
 * After a new deploy, compares live buildId with the tab session and reloads
 * so users pick up fresh JS/CSS without manual cache clear.
 */
export function DeployBuildWatcher({
  initialBuildId,
}: {
  initialBuildId: string;
}) {
  const reloading = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    const buildId = initialBuildId.trim();
    if (!buildId) return;

    const stored = sessionStorage.getItem(STORAGE_KEY);

    if (stored && stored !== buildId) {
      sessionStorage.setItem(STORAGE_KEY, buildId);
      reloading.current = true;
      window.location.reload();
      return;
    }

    if (!stored) {
      sessionStorage.setItem(STORAGE_KEY, buildId);
    }

    const checkLiveBuild = async () => {
      if (reloading.current) return;
      try {
        const res = await fetch("/api/deploy-info", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const live = data.buildId?.trim();
        if (!live) return;

        const known = sessionStorage.getItem(STORAGE_KEY);
        if (known && known !== live) {
          reloading.current = true;
          sessionStorage.setItem(STORAGE_KEY, live);
          window.location.reload();
        }
      } catch {
        /* network — skip */
      }
    };

    const timer = window.setInterval(checkLiveBuild, POLL_MS);
    return () => window.clearInterval(timer);
  }, [initialBuildId]);

  return null;
}
