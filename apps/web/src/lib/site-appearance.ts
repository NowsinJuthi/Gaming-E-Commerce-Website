import { API_BASE } from "@/lib/api";
import type { AccentColor, ResolvedTheme, ThemePreference } from "@/lib/theme";
import {
  isValidAccent,
  isValidPreference,
  resolveTheme,
} from "@/lib/theme";

export type PaletteColors = {
  bg: string;
  elevated: string;
  muted: string;
};

export type SiteAppearance = {
  defaultTheme: ThemePreference;
  accent: AccentColor;
  brandColor: string;
  dark: PaletteColors;
  light: PaletteColors;
  /** Empty = default text logo for light theme */
  logoUrlLight: string;
  /** Empty = default text logo for dark / gaming / amoled */
  logoUrlDark: string;
  /** Empty = use dark site logo in admin header */
  logoUrlAdmin: string;
  /** @deprecated Legacy single footer logo */
  logoUrlFooter: string;
  /** Empty = use light site logo in footer (light theme) */
  logoUrlFooterLight: string;
  /** Empty = use dark site logo in footer (dark theme) */
  logoUrlFooterDark: string;
  logoAlt: string;
  siteName: string;
  /** Empty = default admin dashboard favicon (/icon). */
  adminFaviconUrl: string;
};

export const UNIQBD_LOGO_PATH = "/logo/uniqbd-logo-dark.png";
export const UNIQBD_LOGO_LIGHT_PATH = "/logo/uniqbd-logo-light.png";

export const DEFAULT_SITE_APPEARANCE: SiteAppearance = {
  defaultTheme: "system",
  accent: "emerald",
  brandColor: "#26BFB0",
  dark: { bg: "#01131a", elevated: "#031a22", muted: "#06212a" },
  light: { bg: "#f8fafc", elevated: "#ffffff", muted: "#f1f5f9" },
  logoUrlLight: UNIQBD_LOGO_LIGHT_PATH,
  logoUrlDark: UNIQBD_LOGO_PATH,
  logoUrlAdmin: "",
  logoUrlFooter: "",
  logoUrlFooterLight: "",
  logoUrlFooterDark: "",
  logoAlt: "UniQbd",
  siteName: "UniQbd",
  adminFaviconUrl: "",
};

function uploadPathname(pathname: string): boolean {
  return pathname.startsWith("/api/uploads/");
}

function extractUploadPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/api/uploads/")) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (uploadPathname(parsed.pathname)) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/** Resolve stored logo paths to a browser-loadable URL. */
export function resolveLogoSrc(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return "";
  trimmed = trimmed.replace(/\/api\/api\//i, "/api/");

  const uploadPath = extractUploadPath(trimmed);
  if (uploadPath) {
    return uploadPath;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Next.js public/ assets (served by the web app, not the API).
  if (trimmed.startsWith("/logo/") || trimmed.startsWith("/payments/")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
    return `${apiOrigin}${trimmed}`;
  }

  return trimmed;
}

/** Alias for avatars and other uploaded media paths. */
export const resolveAvatarSrc = resolveLogoSrc;
export const resolveMediaSrc = resolveLogoSrc;

/** Normalize upload URLs for storage — always `/api/uploads/...`. */
export function normalizeStoredUploadUrl(url: string): string {
  return resolveMediaSrc(url);
}

/** Pick logo URL for a resolved theme (light vs dark family). */
export function pickResolvedThemeLogoUrl(
  resolved: ResolvedTheme,
  logoUrlLight: string,
  logoUrlDark: string,
): string {
  const url = resolved === "light" ? logoUrlLight : logoUrlDark;
  return (url ?? "").trim();
}

/** Pick logo URL for the active theme preference. */
export function pickThemeLogoUrl(
  preference: ThemePreference,
  logoUrlLight: string,
  logoUrlDark: string,
): string {
  return pickResolvedThemeLogoUrl(
    resolveTheme(preference),
    logoUrlLight,
    logoUrlDark,
  );
}

const STYLE_ID = "site-appearance-overrides";

/** CSS value for `--header-bg` (same as storefront `bg-header`). */
export function headerBgCssVar(bgHex: string, alpha = 0.92): string {
  const parts = hexToRgbParts(bgHex);
  return `${parts ?? "248 250 252"} / ${alpha}`;
}

export function hexToRgbParts(hex: string): string | null {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** One light + one dark logo shared by header, footer, and admin bar. */
export function unifySiteLogos(appearance: SiteAppearance): SiteAppearance {
  return {
    ...appearance,
    logoUrlAdmin: "",
    logoUrlFooter: "",
    logoUrlFooterLight: "",
    logoUrlFooterDark: "",
  };
}

type RawSiteAppearance = Omit<
  Partial<SiteAppearance>,
  "defaultTheme" | "accent"
> & {
  defaultTheme?: string;
  accent?: string;
  logoUrl?: string;
};

export function normalizeSiteAppearance(
  raw?: RawSiteAppearance | null,
): SiteAppearance {
  const d = DEFAULT_SITE_APPEARANCE;
  const theme = raw?.defaultTheme;
  const accent = raw?.accent;
  return unifySiteLogos({
    defaultTheme:
      theme && isValidPreference(theme) ? theme : d.defaultTheme,
    accent: accent && isValidAccent(accent) ? accent : d.accent,
    brandColor: raw?.brandColor ?? d.brandColor,
    dark: {
      bg: raw?.dark?.bg ?? d.dark.bg,
      elevated: raw?.dark?.elevated ?? d.dark.elevated,
      muted: raw?.dark?.muted ?? d.dark.muted,
    },
    light: {
      bg: raw?.light?.bg ?? d.light.bg,
      elevated: raw?.light?.elevated ?? d.light.elevated,
      muted: raw?.light?.muted ?? d.light.muted,
    },
    logoUrlLight:
      raw?.logoUrlLight ||
      raw?.logoUrl ||
      d.logoUrlLight,
    logoUrlDark:
      raw?.logoUrlDark ||
      raw?.logoUrl ||
      d.logoUrlDark,
    logoUrlAdmin: raw?.logoUrlAdmin?.trim() ?? d.logoUrlAdmin,
    logoUrlFooter: "",
    logoUrlFooterLight: "",
    logoUrlFooterDark: "",
    logoAlt: raw?.logoAlt?.trim() || d.logoAlt,
    siteName: raw?.siteName?.trim() || d.siteName,
    adminFaviconUrl: raw?.adminFaviconUrl?.trim() ?? d.adminFaviconUrl,
  });
}

function shiftRgb(parts: string, delta: number): string {
  return parts
    .split(" ")
    .map((value) => Math.min(255, Math.max(0, Number(value) + delta)))
    .join(" ");
}

function paletteCss(selector: string, palette: PaletteColors): string {
  const bg = hexToRgbParts(palette.bg);
  const elevated = hexToRgbParts(palette.elevated);
  const muted = hexToRgbParts(palette.muted);
  if (!bg || !elevated || !muted) return "";

  const sunken = shiftRgb(bg, -4);
  const border = shiftRgb(muted, 12);
  const borderStrong = shiftRgb(muted, 24);

  return `
    ${selector} {
      --bg: ${bg};
      --bg-elevated: ${elevated};
      --bg-muted: ${muted};
      --bg-sunken: ${sunken};
      --border: ${border};
      --border-strong: ${borderStrong};
      --header-bg: ${bg} / 0.92;
    }
  `;
}

export function buildSiteAppearanceCss(appearance: SiteAppearance): string {
  const brand = hexToRgbParts(appearance.brandColor);

  return `
    :root, [data-theme] {
      ${brand ? `--brand: ${brand};` : ""}
    }
    ${paletteCss('[data-theme="dark"]', appearance.dark)}
    ${paletteCss('[data-theme="gaming"]', appearance.dark)}
    ${paletteCss('[data-theme="amoled"]', appearance.dark)}
    ${paletteCss('[data-theme="light"]', appearance.light)}
  `.trim();
}

export function applySiteAppearance(appearance: SiteAppearance): void {
  if (typeof document === "undefined") return;

  const brand = hexToRgbParts(appearance.brandColor);
  const root = document.documentElement;
  if (brand) {
    root.style.setProperty("--brand", brand);
  }

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = buildSiteAppearanceCss(appearance);
}
