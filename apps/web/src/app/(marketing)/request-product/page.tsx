import type { Metadata } from "next";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { ProductRequestForm } from "@/components/product-requests/ProductRequestForm";
import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/request-product", seo);
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-6 3.5a2 2 0 0 1-2 0l-6-3.5a2 2 0 0 1-1-1.73v-7a2 2 0 0 1 1-1.73l6-3.5a2 2 0 0 1 2 0l6 3.5a2 2 0 0 1 1 1.73Z" />
      <path d="m3.3 7.3 8.7 5 8.7-5" />
      <path d="M12 22V12.3" />
    </svg>
  );
}

export default function RequestProductPage() {
  return (
    <main
      className={`min-h-screen w-full min-w-0 bg-surface pt-4 pb-10 text-foreground ${HOME_CONTAINER_CLS}`}
    >
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-elevated shadow-card">
          <MarketingHeroBubbles />
          <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              <BoxIcon className="h-3.5 w-3.5" />
              Product Request
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Request a <span className="text-brand">New Product</span>.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-foreground-muted">
              Can&apos;t find the game code, gift card or top-up you need? Tell
              us what you&apos;re looking for and our team will try to add it
              to the store — we&apos;ll reply to your email.
            </p>
          </div>
        </section>

      {/* ── Form ── */}
      <section className="mt-8">
        <ProductRequestForm />
      </section>
    </main>
  );
}
