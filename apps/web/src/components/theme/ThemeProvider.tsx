"use client";

import { useEffect } from "react";
import { applyThemeToDocument } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const accent = useThemeStore((s) => s.accent);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setHydrated = useThemeStore((s) => s.setHydrated);

  useEffect(() => {
    const finish = () => {
      const { theme: t, accent: a } = useThemeStore.getState();
      applyThemeToDocument(t, a);
      setHydrated(true);
    };

    if (useThemeStore.persist.hasHydrated()) {
      finish();
    }

    return useThemeStore.persist.onFinishHydration(finish);
  }, [setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    applyThemeToDocument(theme, accent);
  }, [theme, accent, hydrated]);

  useEffect(() => {
    if (!hydrated || theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemeToDocument("system", useThemeStore.getState().accent);
    };

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, hydrated]);

  return <>{children}</>;
}
