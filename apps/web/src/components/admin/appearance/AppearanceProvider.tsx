"use client";

import { adminToast } from "@/lib/admin-toast";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getCustomerPanelAdminSettings,
  updateCustomerPanelSettings,
} from "@/lib/api";
import {
  applySiteAppearance,
  DEFAULT_SITE_APPEARANCE,
  normalizeSiteAppearance,
  unifySiteLogos,
  type PaletteColors,
  type SiteAppearance,
} from "@/lib/site-appearance";
import { applySiteBrand } from "@/stores/site-brand-store";
import { applyAdminFavicon } from "@/stores/admin-favicon-store";

type AppearanceContextValue = {
  appearance: SiteAppearance;
  setAppearance: React.Dispatch<React.SetStateAction<SiteAppearance>>;
  updatePalette: (
    mode: "dark" | "light",
    key: keyof PaletteColors,
    value: string,
  ) => void;
  ready: boolean;
  busy: boolean;
  save: () => Promise<void>;
  saveAppearance: (next: SiteAppearance) => Promise<void>;
  resetDefaults: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<SiteAppearance>(
    DEFAULT_SITE_APPEARANCE,
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const appearanceRef = useRef(appearance);
  const saveBusyRef = useRef(false);
  appearanceRef.current = appearance;

  const load = useCallback(() => {
    getCustomerPanelAdminSettings()
      .then((s) => setAppearance(normalizeSiteAppearance(s.appearance)))
      .catch(() => setAppearance(DEFAULT_SITE_APPEARANCE))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePalette = useCallback(
    (mode: "dark" | "light", key: keyof PaletteColors, value: string) => {
      setAppearance((cur) => ({
        ...cur,
        [mode]: { ...cur[mode], [key]: value },
      }));
    },
    [],
  );

  const persistAppearance = useCallback(async (next: SiteAppearance) => {
    if (saveBusyRef.current) {
      throw new Error("A save is already in progress. Please wait a moment and try again.");
    }
    saveBusyRef.current = true;
    setBusy(true);
    try {
      const unified = unifySiteLogos(next);
      await updateCustomerPanelSettings({ appearance: unified });
      setAppearance(unified);
      applySiteAppearance(unified);
      applySiteBrand(unified);
      applyAdminFavicon(unified.adminFaviconUrl);
      return unified;
    } finally {
      saveBusyRef.current = false;
      setBusy(false);
    }
  }, []);

  const save = useCallback(async () => {
    try {
      await persistAppearance(appearanceRef.current);
      adminToast("Appearance saved. Changes are live for all visitors.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed", false);
    }
  }, [persistAppearance]);

  const saveAppearance = useCallback(
    async (next: SiteAppearance) => {
      try {
        await persistAppearance(next);
      } catch (err) {
        adminToast(err instanceof Error ? err.message : "Save failed", false);
        throw err;
      }
    },
    [persistAppearance],
  );

  const resetDefaults = useCallback(() => {
    setAppearance(DEFAULT_SITE_APPEARANCE);
    adminToast("Reset to defaults — click Save to apply.", true);
  }, []);

  const value = useMemo(
    () => ({
      appearance,
      setAppearance,
      updatePalette,
      ready,
      busy,
      save,
      saveAppearance,
      resetDefaults,
    }),
    [appearance, ready, busy, updatePalette, save, saveAppearance, resetDefaults],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearanceSettings(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearanceSettings must be used within AppearanceProvider");
  }
  return ctx;
}
