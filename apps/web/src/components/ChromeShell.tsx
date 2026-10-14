"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isMediaCatalogPath } from "@/lib/storefront-nav";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactSocialProvider } from "@/components/ContactSocialProvider";
import { SiteMenusProvider } from "@/components/SiteMenusProvider";
import { isCustomerPanelRoute } from "@/lib/customer-nav";
import type { SiteMenusConfig } from "@/lib/site-menus";
import type { SiteAppearance } from "@/lib/site-appearance";
import type { ContactSettings, PublicSeoConfig } from "@/lib/api";
import { ContactEmailPopup } from "@/components/contact/ContactEmailPopup";
import { DocumentFaviconHead } from "@/components/DocumentFaviconHead";
import { ReferralTracker } from "@/components/ReferralTracker";
import { SiteAppearanceProvider } from "@/components/theme/SiteAppearanceProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { LiveChatLauncher } from "@/components/chat/LiveChatLauncher";
import { StoreEventsProvider } from "@/components/StoreEventsProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { SitePresenceTracker } from "@/components/analytics/SitePresenceTracker";
import { RecaptchaBadgeVisibility } from "@/components/RecaptchaBadgeVisibility";

export function ChromeShell({
  children,
  initialSiteMenus,
  initialAppearance,
  initialContactSocial,
  initialContactSettings,
  initialSeoSocial,
  allowGuestChat = false,
}: {
  children: React.ReactNode;
  initialSiteMenus?: SiteMenusConfig;
  initialAppearance?: SiteAppearance;
  initialContactSocial?: {
    facebookUrl?: string;
    youtubeUrl?: string;
    whatsappUrl?: string;
  };
  initialContactSettings?: ContactSettings;
  initialSeoSocial?: PublicSeoConfig["social"];
  allowGuestChat?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isCustomerPanel = isCustomerPanelRoute(pathname);
  const isCompactStorefrontMain = pathname === "/";
  const isMediaCatalog = isMediaCatalogPath(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "media-catalog-route",
      isMediaCatalog,
    );
    return () => {
      document.documentElement.classList.remove("media-catalog-route");
    };
  }, [isMediaCatalog]);

  if (isAdmin || isCustomerPanel) {
    return (
      <QueryProvider enableDevtools={isAdmin}>
        <ThemeProvider>
          <SiteAppearanceProvider initialAppearance={initialAppearance}>
            <DocumentFaviconHead />
            <StoreEventsProvider />
            <SitePresenceTracker />
            <RecaptchaBadgeVisibility />
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            {children}
            <LiveChatLauncher allowGuestChat={allowGuestChat} />
            <Toaster />
          </SiteAppearanceProvider>
        </ThemeProvider>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider enableDevtools={false}>
      <ThemeProvider>
        <SiteAppearanceProvider initialAppearance={initialAppearance}>
          <DocumentFaviconHead />
          <StoreEventsProvider />
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <div className="chrome-shell flex min-h-screen min-w-0 flex-col">
            <SitePresenceTracker />
            <RecaptchaBadgeVisibility />
            <ReferralTracker />
            <SiteMenusProvider initialMenus={initialSiteMenus}>
              <ContactSocialProvider
                facebookUrl={initialContactSocial?.facebookUrl}
                youtubeUrl={initialContactSocial?.youtubeUrl}
                whatsappUrl={initialContactSocial?.whatsappUrl}
              >
                <Header />
                <div className="h-14 shrink-0 sm:h-16" aria-hidden />
                <div
                  id="main-content"
                  className={`min-w-0${isCompactStorefrontMain ? "" : " flex-1"}`}
                >
                  {children}
                </div>
                <Footer
                  contact={initialContactSettings}
                  seo={
                    initialSeoSocial
                      ? { social: initialSeoSocial }
                      : undefined
                  }
                />
              </ContactSocialProvider>
            </SiteMenusProvider>
          </div>
          <ContactEmailPopup disableOnContactPage />
          <LiveChatLauncher allowGuestChat={allowGuestChat} />
          <Toaster />
        </SiteAppearanceProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
