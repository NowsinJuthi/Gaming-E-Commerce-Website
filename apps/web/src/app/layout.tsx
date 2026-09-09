import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ChromeShell } from "@/components/ChromeShell";
import { SiteFaviconHeadLinks } from "@/components/SiteFaviconHeadLinks";
import { DevToolsAdminGate } from "@/components/dev/DevToolsAdminGate";
import { DevToolsAdminScript } from "@/components/dev/DevToolsAdminScript";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  GaHeadScript,
  GtmNoScript,
  SeoScripts,
} from "@/components/seo/SeoScripts";
import { ThemeScript } from "@/components/theme/ThemeScript";
import {
  buildSiteAppearanceCss,
  normalizeSiteAppearance,
} from "@/lib/site-appearance";
import { SITE_FAVICON_PATH } from "@/lib/site-favicon";
import { pickFaviconSource, publicFaviconLinkMime } from "@/lib/public-favicon";
import {
  DEFAULT_OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  socialSameAs,
} from "@/lib/seo";
import { normalizeSiteMenus } from "@/lib/site-menus";
import { getPreconnectOrigins } from "@/lib/resource-hints";
import {
  getCachedCustomerPanelConfig,
  getCachedContactPageSettings,
  getCachedSeoConfig,
} from "@/lib/server-cache";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import { getAppBuildId } from "@/lib/build-id";

const isDev = process.env.NODE_ENV === "development";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  const base = seo.canonicalDomain.replace(/\/$/, "");
  const title = seo.siteTitle;
  const description = seo.siteDescription;
  const ogImage = seo.homepage.ogImage || DEFAULT_OG_IMAGE;

  const faviconHref = SITE_FAVICON_PATH;
  let faviconType = "image/png";
  try {
    const panelConfig = await getCachedCustomerPanelConfig();
    const appearance = normalizeSiteAppearance(panelConfig.appearance);
    const raw = pickFaviconSource(appearance);
    if (raw) {
      faviconType = publicFaviconLinkMime(raw);
    }
  } catch {
    /* default /favicon */
  }

  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      template: `%s — ${SITE_NAME}`,
    },
    description,
    applicationName: SITE_NAME,
    keywords: seo.keywords.length > 0 ? seo.keywords : undefined,
    alternates: {
      canonical: "/",
      languages: { "en-US": "/", "x-default": "/" },
    },
    verification: {
      google: seo.verification.google || undefined,
      other: seo.verification.bing
        ? { "msvalidate.01": seo.verification.bing }
        : {},
    },
    robots:
      seo.robots.index === false
        ? { index: false, follow: seo.robots.follow }
        : {
            index: true,
            follow: seo.robots.follow,
            googleBot: {
              index: true,
              follow: seo.robots.follow,
              "max-image-preview": "large",
              "max-snippet": -1,
              "max-video-preview": -1,
            },
          },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: base,
      locale: SITE_LOCALE,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [seo, panelConfig, contactSettings] = await Promise.all([
    getCachedSeoConfig(),
    getCachedCustomerPanelConfig(),
    getCachedContactPageSettings(),
  ]);
  const initialSiteMenus = normalizeSiteMenus(panelConfig.siteMenus);
  const initialAppearance = normalizeSiteAppearance(panelConfig.appearance);
  const appearanceCss = buildSiteAppearanceCss(initialAppearance);
  const sameAs = socialSameAs(seo.social);
  const schemas = [
    seo.schema.organization
      ? organizationSchema({
          name: seo.siteTitle ? SITE_NAME : undefined,
          url: seo.canonicalDomain,
          description: seo.siteDescription,
          // Real brand logo (Google requires ≥112px; the favicon is too small).
          logoUrl:
            initialAppearance.logoUrlDark || initialAppearance.logoUrlLight,
          sameAs,
        })
      : null,
    seo.schema.website
      ? websiteSchema({ url: seo.canonicalDomain })
      : null,
  ].filter((s): s is Record<string, unknown> => s !== null);
  const preconnectOrigins = getPreconnectOrigins(seo.canonicalDomain);
  const faviconRaw = pickFaviconSource(initialAppearance);
  const appBuildId = getAppBuildId();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {appBuildId ? (
          <meta name="uniqbd-build-id" content={appBuildId} />
        ) : null}
        <SiteFaviconHeadLinks faviconRaw={faviconRaw} />
        {preconnectOrigins.map((origin) => (
          <link
            key={origin}
            rel="preconnect"
            href={origin}
            crossOrigin="anonymous"
          />
        ))}
        <ThemeScript
          defaults={{
            defaultTheme: initialAppearance.defaultTheme,
            accent: initialAppearance.accent,
          }}
        />
        <style
          id="site-appearance-overrides"
          dangerouslySetInnerHTML={{ __html: appearanceCss }}
        />
        {/* Must stay inside <head>: Search Console GA verification checks here. */}
        <GaHeadScript googleAnalyticsId={seo.analytics.googleAnalyticsId} />
      </head>
      <body>
        <GtmNoScript gtmId={seo.analytics.gtmId} />
        {schemas.length > 0 ? <JsonLd data={schemas} /> : null}
        <SeoScripts
          gtmId={seo.analytics.gtmId}
          facebookPixelId={seo.analytics.facebookPixelId}
        />
        {isDev ? <DevToolsAdminScript /> : null}
        {isDev ? <DevToolsAdminGate /> : null}
        <ChromeShell
          initialSiteMenus={initialSiteMenus}
          initialAppearance={initialAppearance}
          initialContactSocial={{
            facebookUrl: contactSettings.social?.facebookUrl ?? "",
            youtubeUrl: contactSettings.social?.youtubeUrl ?? "",
            whatsappUrl: contactSettings.social?.whatsappUrl ?? "",
          }}
          initialContactSettings={contactSettings}
          initialSeoSocial={seo.social}
          allowGuestChat={panelConfig.checkout.allowGuestChat}
        >
          {children}
        </ChromeShell>
      </body>
    </html>
  );
}
