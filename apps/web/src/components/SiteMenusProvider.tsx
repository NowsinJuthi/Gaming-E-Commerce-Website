"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCustomerPanelConfig } from "@/lib/customer-panel";
import {
  DEFAULT_SITE_MENUS,
  normalizeSiteMenus,
  type SiteMenusConfig,
} from "@/lib/site-menus";

const SiteMenusContext = createContext<SiteMenusConfig>(DEFAULT_SITE_MENUS);

export function SiteMenusProvider({
  children,
  initialMenus,
}: {
  children: ReactNode;
  initialMenus?: SiteMenusConfig;
}) {
  const [menus, setMenus] = useState<SiteMenusConfig>(() =>
    normalizeSiteMenus(initialMenus ?? DEFAULT_SITE_MENUS),
  );

  useEffect(() => {
    let cancelled = false;

    getCustomerPanelConfig()
      .then((config) => {
        if (cancelled) return;
        setMenus(normalizeSiteMenus(config.siteMenus));
      })
      .catch(() => {
        /* keep SSR menus */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => menus, [menus]);

  return (
    <SiteMenusContext.Provider value={value}>{children}</SiteMenusContext.Provider>
  );
}

export function useSiteMenus(): SiteMenusConfig {
  return useContext(SiteMenusContext);
}
