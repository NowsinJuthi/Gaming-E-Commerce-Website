import type { Metadata } from "next";
import { Suspense } from "react";
import {
  HOME_CONTAINER_CLS,
  HOME_PAGE_BG,
} from "@/components/home/home-container";
import { HomePageCatalog } from "@/components/home/HomePageCatalog";
import { HomePageHero } from "@/components/home/HomePageHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";
import { faqSchema } from "@/lib/structured-data";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/", seo);
}

function HomeHeroFallback() {
  return (
    <div
      className="home-hero-skeleton mb-4 aspect-[2.4/1] w-full max-w-full animate-pulse rounded-2xl bg-border/30 sm:mb-6"
      aria-hidden
    />
  );
}

function HomeCatalogFallback() {
  return (
    <div className="space-y-6 py-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-border/40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((__, card) => (
              <div
                key={card}
                className="product-catalog-card animate-pulse"
                aria-hidden
              >
                <div className="aspect-square rounded-lg bg-border/30" />
                <div className="mt-3 h-4 w-3/4 rounded bg-border/30" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  // Admin-managed FAQ schema (SEO settings → Schema → FAQ).
  const seo = await getCachedSeoConfig();
  const faqItems = seo.schema.faq
    ? seo.schema.faqItems.filter((f) => f.question.trim() && f.answer.trim())
    : [];

  return (
    <main className={`pb-4 pt-2 sm:pb-8 sm:pt-4 ${HOME_PAGE_BG}`}>
      {faqItems.length > 0 ? <JsonLd data={faqSchema(faqItems)} /> : null}
      <h1 className="sr-only">Home</h1>
      <div className={HOME_CONTAINER_CLS}>
        <Suspense fallback={<HomeHeroFallback />}>
          <HomePageHero />
        </Suspense>
        <Suspense fallback={<HomeCatalogFallback />}>
          <HomePageCatalog />
        </Suspense>
      </div>
    </main>
  );
}
