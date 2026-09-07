import { cache } from "react";
import { getContactPageSettings, getCustomerPanelConfig, getWebsitePageSettings } from "@/lib/api";
import { getHomeCategoryProductSections } from "@/lib/homepage-sections";
import { fetchSeoConfig } from "@/lib/seo";

/** Dedupe SEO config across generateMetadata, layout, and pages in one request. */
export const getCachedSeoConfig = cache(() => fetchSeoConfig());

/** Dedupe storefront panel config across layout and homepage in one request. */
export const getCachedCustomerPanelConfig = cache(() =>
  getCustomerPanelConfig({ cached: true, revalidate: 60 }),
);

/** Dedupe homepage product sections within a single render. */
export const getCachedHomeCategoryProductSections = cache(() =>
  getHomeCategoryProductSections({
    limitPerCategory: 6,
    revalidate: 60,
  }),
);

/** Dedupe contact page settings for layout footer social icons. */
export const getCachedContactPageSettings = cache(() =>
  getContactPageSettings(),
);

/** Dedupe website pricing settings for /website page. */
export const getCachedWebsitePageSettings = cache(() =>
  getWebsitePageSettings({ cached: true, revalidate: 300 }),
);
