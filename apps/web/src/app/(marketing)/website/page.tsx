import type { Metadata } from "next";
import { WebsiteHeroInfo } from "@/components/marketing/WebsiteHeroInfo";
import { WebsiteInfoSections } from "@/components/marketing/WebsiteInfoSections";
import { WebsitePricingSection } from "@/components/marketing/WebsitePricingSection";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { getWebsitePageSettings } from "@/lib/api";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";
import {
  getVisibleWebsitePackages,
  normalizeWebsitePageSettings,
} from "@/lib/website-page-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/website", seo);
}

export default async function WebsitePage() {
  const raw = await getWebsitePageSettings({ cached: true, revalidate: 300 });
  const settings = normalizeWebsitePageSettings(raw);
  const packages = getVisibleWebsitePackages(settings);

  return (
    <main
      className={`website-page min-h-screen w-full min-w-0 bg-surface py-10 text-foreground md:py-12 ${HOME_CONTAINER_CLS}`}
    >
      <WebsiteHeroInfo
        eyebrow={settings.heroEyebrow}
        heading={settings.heading}
        subheading={settings.subheading}
        offerTitle={settings.offerTitle}
        offerText={settings.offerText}
        heroNoteTitle={settings.heroNoteTitle}
        heroNoteText={settings.heroNoteText}
        heroNoteSubtext={settings.heroNoteSubtext}
      />
      <WebsitePricingSection packages={packages} />
      <WebsiteInfoSections
        introSection={settings.introSection}
        guideSection={settings.guideSection}
      />
    </main>
  );
}
