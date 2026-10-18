export type ThemePreference = "light" | "dark" | "system" | "gaming" | "amoled";
export type ResolvedTheme = "light" | "dark" | "gaming" | "amoled";
export type AccentColor = "indigo" | "violet" | "cyan" | "emerald" | "rose";

const VALID_PREFERENCES = new Set<string>([
  "light",
  "dark",
  "system",
  "gaming",
  "amoled",
]);

const VALID_ACCENTS = new Set<string>([
  "indigo",
  "violet",
  "cyan",
  "emerald",
  "rose",
]);

/** Default theme for new visitors (before any saved preference). */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

/** Navbar / quick-toggle cycle: Light → Dark → System */
export const NAV_THEME_CYCLE: ThemePreference[] = ["light", "dark", "system"];

export const THEME_MODES: Array<{
  id: ThemePreference;
  label: string;
  description: string;
}> = [
  { id: "light", label: "Light", description: "Clean daylight interface" },
  { id: "dark", label: "Dark", description: "Reduced glare for evening use" },
  {
    id: "system",
    label: "System",
    description: "Matches your device light/dark setting",
  },
  {
    id: "gaming",
    label: "Gaming",
    description: "Neon gradients and premium marketplace feel",
  },
  {
    id: "amoled",
    label: "AMOLED",
    description: "True black backgrounds for OLED displays",
  },
];

export const THEME_PREVIEW_GRADIENT: Record<ThemePreference, string> = {
  light: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
  system:
    "linear-gradient(135deg, #f8fafc 0%, #f8fafc 50%, #0f172a 50%, #334155 100%)",
  dark: "linear-gradient(135deg, #01131a, #06212a)",
  gaming: "linear-gradient(135deg, #0a0818, #6366f1, #06b6d4)",
  amoled: "linear-gradient(135deg, #000, #171717)",
};

export const ACCENT_COLORS: Array<{
  id: AccentColor;
  label: string;
  swatch: string;
}> = [
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "cyan", label: "Cyan", swatch: "#06b6d4" },
  { id: "emerald", label: "Emerald", swatch: "#10b981" },
  { id: "rose", label: "Rose", swatch: "#f43f5e" },
];

export const THEME_STORAGE_KEY = "uniqbd-theme";
export const ACCENT_STORAGE_KEY = "uniqbd-accent";

export function isValidPreference(value: string): value is ThemePreference {
  return VALID_PREFERENCES.has(value);
}

export function isValidAccent(value: string): value is AccentColor {
  return VALID_ACCENTS.has(value);
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

export function isResolvedThemeDark(resolved: ResolvedTheme): boolean {
  return resolved === "dark" || resolved === "gaming" || resolved === "amoled";
}

/** Flip between light and dark based on what the user currently sees. */
export function toggleLightDarkPreference(
  preference: ThemePreference,
): ThemePreference {
  const resolved = resolveTheme(preference);
  return isResolvedThemeDark(resolved) ? "light" : "dark";
}

/** Match server render for theme-dependent assets before client hydration. */
export function getSsrSafeResolvedTheme(
  preference: ThemePreference,
): ResolvedTheme {
  if (preference === "system") return "light";
  return preference;
}

export function applyThemeToDocument(
  preference: ThemePreference,
  accent: AccentColor,
) {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(preference);
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.dataset.accent = accent;

  const isDark = resolved !== "light";
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function readStoredTheme(): {
  theme: ThemePreference;
  accent: AccentColor;
} {
  if (typeof window === "undefined") {
    return { theme: DEFAULT_THEME_PREFERENCE, accent: "emerald" };
  }

  try {
    const raw = localStorage.getItem("uniqbd-theme-store");
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: string; accent?: string } };
      const theme = parsed?.state?.theme;
      const accent = parsed?.state?.accent;
      return {
        theme: theme && isValidPreference(theme) ? theme : DEFAULT_THEME_PREFERENCE,
        accent: accent && isValidAccent(accent) ? accent : "emerald",
      };
    }
  } catch {
    /* fall through */
  }

  const legacyTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const legacyAccent = localStorage.getItem(ACCENT_STORAGE_KEY);

  return {
    theme:
      legacyTheme && isValidPreference(legacyTheme)
        ? legacyTheme
        : DEFAULT_THEME_PREFERENCE,
    accent:
      legacyAccent && isValidAccent(legacyAccent) ? legacyAccent : "emerald",
  };
}

export function getThemeLabel(
  preference: ThemePreference,
  resolved?: ResolvedTheme,
): string {
  if (preference === "system") {
    const systemResolved = resolved ?? resolveTheme("system");
    return `System (${systemResolved === "dark" ? "Dark" : "Light"})`;
  }
  return THEME_MODES.find((m) => m.id === preference)?.label ?? preference;
}
