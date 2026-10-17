"use client";
import { hasAuthSession } from "@/lib/access-token";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerTopbar } from "@/components/customer/CustomerTopbar";
import { Header } from "@/components/Header";
import { HOME_CONTAINER_CLS, HOME_PAGE_BG } from "@/components/home/home-container";
import {
  filterNav,
  getCachedPanelConfig,
  getCustomerPanelConfig,
  PANEL_CONFIG_CHANGED_EVENT,
  type CustomerPanelConfig,
} from "@/lib/customer-panel";
import { isCustomerCartRoute, isCustomerCheckoutRoute } from "@/lib/customer-nav";

export function CustomerPanelShell({
  children,
  title,
  requireAuth = false,
}: {
  children: React.ReactNode;
  title?: string;
  requireAuth?: boolean;
}) {
  const pathname = usePathname();
  const [config, setConfig] = useState<CustomerPanelConfig | null>(() =>
    getCachedPanelConfig(),
  );
  const [loggedIn, setLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const sync = () => setLoggedIn(hasAuthSession());
    sync();
    window.addEventListener("auth-change", sync);
    void getCustomerPanelConfig().then(setConfig);

    const onPanelConfigChanged = () => {
      void getCustomerPanelConfig().then(setConfig);
    };
    window.addEventListener(PANEL_CONFIG_CHANGED_EVENT, onPanelConfigChanged);

    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener(PANEL_CONFIG_CHANGED_EVENT, onPanelConfigChanged);
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    const root = document.documentElement;
    root.classList.remove("chat-messenger-open", "chat-keyboard-open");
    root.style.removeProperty("--chat-vvh");
    root.style.removeProperty("--chat-vv-top");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
  }, [pathname]);

  const nav = config
    ? filterNav(config)
    : { shop: [], blog: [], accountSections: [] };
  const siteName = config?.storefront.siteName ?? "UniQbd";
  const checkoutFocus = isCustomerCheckoutRoute(pathname);
  const cartFocus = isCustomerCartRoute(pathname);

  if (checkoutFocus) {
    return (
      <div
        className={`customer-panel customer-panel--checkout-focus w-full min-w-0 ${HOME_PAGE_BG}`}
      >
        <div className={`w-full min-w-0 pt-4 pb-10 ${HOME_CONTAINER_CLS}`}>
          {config?.storefront.maintenanceMode ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Store is in maintenance mode. Some features may be limited.
            </div>
          ) : null}
          {!loggedIn && requireAuth ? (
            <p className="mb-4 text-sm text-foreground-muted">
              Please log in to access this page.
            </p>
          ) : null}
          {children}
        </div>
      </div>
    );
  }

  if (cartFocus) {
    return (
      <div className="admin-panel customer-panel customer-panel--cart-focus min-h-screen min-w-0 bg-surface text-foreground">
        <main className={`w-full min-w-0 pt-4 pb-10 ${HOME_CONTAINER_CLS}`}>
          {title ? (
            <h1 className="mb-4 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">
              {title}
            </h1>
          ) : null}
          {config?.storefront.maintenanceMode ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Store is in maintenance mode. Some features may be limited.
            </div>
          ) : null}
          {!loggedIn && requireAuth ? (
            <p className="mb-4 text-sm text-foreground-muted">
              Please log in to access this page.
            </p>
          ) : null}
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="admin-panel customer-panel min-h-screen min-w-0 overflow-x-clip bg-surface text-foreground">
      {/* Sidebar backdrop — mobile only */}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/50 backdrop-blur-sm sm:top-16 lg:hidden"
        />
      ) : null}

      {/* Storefront header for account pages below lg (sidebar menu + shop nav) */}
      <div className="customer-panel-mobile-store-header lg:hidden">
        <Header onOpenMobileMenu={() => setSidebarOpen(true)} />
      </div>

      {/* Customer topbar (>= lg) — no duplicate storefront nav */}
      <div className="customer-panel-desktop-topbar hidden lg:block">
        <CustomerTopbar pathname={pathname} onOpenMenu={() => {}} />
      </div>

      <CustomerSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        shop={nav.shop}
        blog={nav.blog}
        accountSections={nav.accountSections}
        siteName={siteName}
      />

      <div className="w-full min-w-0 pt-14 sm:pt-16 lg:pl-80">
        <main className="w-full min-w-0 p-2 sm:p-3 md:p-4 lg:p-6">
          {title ? (
            <h1 className="mb-4 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">
              {title}
            </h1>
          ) : null}
          {config?.storefront.maintenanceMode ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Store is in maintenance mode. Some features may be limited.
            </div>
          ) : null}
          {!loggedIn && requireAuth ? (
            <p className="mb-4 text-sm text-foreground-muted">
              Please log in to access this page.
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
