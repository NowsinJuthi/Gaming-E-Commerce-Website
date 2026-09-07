"use client";

import { ThemePreferenceIcon } from "@/components/theme/ThemeToggle";
import { NAV_THEME_CYCLE, THEME_MODES } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

export function NavThemePicker() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="site-mobile-theme-grid">
      {NAV_THEME_CYCLE.map((id) => {
        const mode = THEME_MODES.find((t) => t.id === id)!;
        const active = theme === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setTheme(mode.id)}
            className={`site-mobile-theme-btn${
              active ? " site-mobile-theme-btn--active" : ""
            }`}
            aria-pressed={active}
            aria-label={`${mode.label} theme`}
          >
            <span className="site-mobile-theme-btn-icon" aria-hidden>
              <ThemePreferenceIcon preference={mode.id} className="h-4 w-4" />
            </span>
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
