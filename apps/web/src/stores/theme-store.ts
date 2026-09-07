"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyThemeToDocument,
  isValidAccent,
  DEFAULT_THEME_PREFERENCE,
  isValidPreference,
  type AccentColor,
  type ThemePreference,
} from "@/lib/theme";

type ThemeState = {
  theme: ThemePreference;
  accent: AccentColor;
  /** True after the user manually changes theme or accent on this device. */
  customized: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentColor) => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME_PREFERENCE,
      accent: "emerald",
      customized: false,
      hydrated: false,
      setTheme: (theme) => {
        set({ theme, customized: true });
        applyThemeToDocument(theme, get().accent);
      },
      setAccent: (accent) => {
        set({ accent, customized: true });
        applyThemeToDocument(get().theme, accent);
      },
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "uniqbd-theme-store",
      partialize: (s) => ({
        theme: s.theme,
        accent: s.accent,
        customized: s.customized,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!isValidPreference(state.theme)) {
          state.theme = DEFAULT_THEME_PREFERENCE;
        }
        if (!isValidAccent(state.accent)) state.accent = "emerald";
        if (state.customized !== true) state.customized = false;
        applyThemeToDocument(state.theme, state.accent);
        state.setHydrated(true);
      },
    },
  ),
);
