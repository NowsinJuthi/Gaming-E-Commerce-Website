"use client";

import { SiteLogo } from "@/components/SiteLogo";
import { resolveLogoSrc } from "@/lib/site-appearance";
import { getSsrSafeResolvedTheme, resolveTheme } from "@/lib/theme";
import { useSiteBrandStore } from "@/stores/site-brand-store";
import { useThemeStore } from "@/stores/theme-store";

type Props = {
  href?: string | null;
  className?: string;
};

export function AdminHeaderLogo({ href = "/", className = "" }: Props) {
  const themePref = useThemeStore((s) => s.theme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const logoUrlLight = useSiteBrandStore((s) => s.logoUrlLight);
  const logoUrlDark = useSiteBrandStore((s) => s.logoUrlDark);
  const logoUrlAdmin = useSiteBrandStore((s) => s.logoUrlAdmin);
  const logoAlt = useSiteBrandStore((s) => s.logoAlt);
  const siteName = useSiteBrandStore((s) => s.siteName);

  const resolved = themeHydrated
    ? resolveTheme(themePref)
    : getSsrSafeResolvedTheme(themePref);
  const previewTheme = resolved === "light" ? "light" : "dark";

  const adminLogo = resolveLogoSrc(logoUrlAdmin);
  return (
    <div className={`admin-topbar-logo shrink-0 ${className}`}>
      <SiteLogo
        href={href}
        size="admin"
        showWave={false}
        title="Back to store"
        override={{
          logoUrlLight: adminLogo || logoUrlLight,
          logoUrlDark: adminLogo || logoUrlDark,
          logoAlt,
          siteName,
          previewTheme,
        }}
      />
    </div>
  );
}
