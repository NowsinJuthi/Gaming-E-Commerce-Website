import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundArt } from "@/components/errors/NotFoundArt";
import { NotFoundGoBackButton } from "@/components/errors/NotFoundGoBackButton";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: `Page Not Found — ${SITE_NAME}` },
  description:
    "Sorry, the page you are looking for does not exist or has been moved.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="main-content" className="login-page">
      <MarketingHeroBubbles />
      <div className="login-page__inner max-w-lg">
        <div
          className="login-page__card"
          role="alert"
          aria-labelledby="not-found-title"
        >
          <NotFoundArt />
          <div className="login-page__header">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
              Error 404
            </p>
            <h1 id="not-found-title" className="login-page__title mt-3">
              Page Not Found
            </h1>
            <p className="login-page__subtitle mt-3 text-base">
              Sorry, the page you are looking for does not exist or has been
              moved.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <NotFoundGoBackButton />
            <Link href="/" className="btn-primary btn-primary-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
