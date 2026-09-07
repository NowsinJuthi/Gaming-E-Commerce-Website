import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { SITE_FAVICON_PATH } from "@/lib/site-favicon";
import { publicFaviconLinkMime } from "@/lib/public-favicon";
import { normalizeSiteAppearance } from "@/lib/site-appearance";
import { getCachedCustomerPanelConfig } from "@/lib/server-cache";

const ADMIN_TITLE = {
  template: "%s · Admin",
  default: "Administration Dashboard",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  let faviconType = "image/png";

  try {
    const config = await getCachedCustomerPanelConfig();
    const appearance = normalizeSiteAppearance(config.appearance);
    const raw = appearance.adminFaviconUrl.trim();
    if (raw) {
      faviconType = publicFaviconLinkMime(raw);
    }
  } catch {
    /* default /favicon */
  }

  const faviconHref = SITE_FAVICON_PATH;

  return {
    title: ADMIN_TITLE,
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: faviconHref, type: faviconType, sizes: "32x32" },
        { url: faviconHref, type: faviconType, sizes: "16x16" },
      ],
      shortcut: [{ url: faviconHref, type: faviconType }],
      apple: [{ url: faviconHref, sizes: "180x180", type: faviconType }],
    },
  };
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
