"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { getCustomerPanelConfig } from "@/lib/customer-panel";
import {
  applySiteAppearance,
  normalizeSiteAppearance,
  type SiteAppearance,
} from "@/lib/site-appearance";
import { applySiteBrand, type SiteBrand } from "@/stores/site-brand-store";
import { applyAdminFavicon } from "@/stores/admin-favicon-store";
import { applyThemeToDocument, isValidAccent, isValidPreference } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";
import { SiteBrandInitialProvider } from "@/components/site-brand-initial-context";

function pickSiteBrand(appearance: SiteAppearance): SiteBrand {
  return {
    logoUrlLight: appearance.logoUrlLight,
    logoUrlDark: appearance.logoUrlDark,
    logoUrlAdmin: appearance.logoUrlAdmin,
    logoUrlFooterLight: appearance.logoUrlFooterLight,
    logoUrlFooterDark: appearance.logoUrlFooterDark,
    logoAlt: appearance.logoAlt,
    siteName: appearance.siteName,
  };
}

export function SiteAppearanceProvider({
  children,
  initialAppearance,
}: {
  children: React.ReactNode;
  initialAppearance?: SiteAppearance;
}) {
  const appearance = useMemo(
    () => normalizeSiteAppearance(initialAppearance ?? null),
    [initialAppearance],
  );
  const initialBrand = useMemo(() => pickSiteBrand(appearance), [appearance]);

  useLayoutEffect(() => {
    applySiteAppearance(appearance);
    applySiteBrand(appearance);
    applyAdminFavicon(appearance.adminFaviconUrl ?? "");
  }, [appearance]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const config = await getCustomerPanelConfig();
        if (cancelled) return;

        const appearance = normalizeSiteAppearance(config.appearance);
        applySiteAppearance(appearance);
        applySiteBrand(appearance);
        applyAdminFavicon(appearance.adminFaviconUrl ?? "");

        const { theme, accent, customized, setTheme, setAccent } =
          useThemeStore.getState();

        if (!customized) {
          if (isValidPreference(appearance.defaultTheme)) {
            setTheme(appearance.defaultTheme);
          }
          if (isValidAccent(appearance.accent)) {
            setAccent(appearance.accent);
          }
        } else {
          applyThemeToDocument(theme, accent);
        }
      } catch {
        if (cancelled) return;
        applySiteAppearance(appearance);
        applySiteBrand(appearance);
        applyAdminFavicon(appearance.adminFaviconUrl ?? "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appearance]);

  return (
    <SiteBrandInitialProvider brand={initialBrand}>
      {children}
    </SiteBrandInitialProvider>
  );
}
