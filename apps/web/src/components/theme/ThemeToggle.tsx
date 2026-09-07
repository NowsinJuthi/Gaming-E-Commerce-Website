"use client";

import {
  DEFAULT_THEME_PREFERENCE,
  getSsrSafeResolvedTheme,
  getThemeLabel,
  NAV_THEME_CYCLE,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const theme = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setTheme = useThemeStore((s) => s.setTheme);

  function cycle() {
    const idx = NAV_THEME_CYCLE.indexOf(
      NAV_THEME_CYCLE.includes(theme) ? theme : DEFAULT_THEME_PREFERENCE,
    );
    const next = NAV_THEME_CYCLE[(idx + 1) % NAV_THEME_CYCLE.length]!;
    setTheme(next);
  }

  const resolvedTheme = hydrated
    ? resolveTheme(theme)
    : getSsrSafeResolvedTheme(theme);
  const label = getThemeLabel(theme, resolvedTheme);

  return (
    <button
      type="button"
      onClick={cycle}
      className={`btn-ghost min-h-[44px] min-w-[44px] rounded-xl px-2.5 ${className}`.trim()}
      aria-label={`Theme: ${label}. Click to switch`}
      title={label}
      suppressHydrationWarning
    >
      <ThemeIcon preference={theme} />
      {showLabel && (
        <span className="hidden text-xs font-medium lg:inline">{label}</span>
      )}
    </button>
  );
}

export function ThemePreferenceIcon({
  preference,
  className = "h-5 w-5",
}: {
  preference: ThemePreference;
  className?: string;
}) {
  if (preference === "light") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeWidth={2}
          d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z"
        />
      </svg>
    );
  }

  if (preference === "system") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  return <ThemePreferenceIcon preference={preference} />;
}
