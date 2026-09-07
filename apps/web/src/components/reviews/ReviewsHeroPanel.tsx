import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { ReviewsHeroArt } from "@/components/reviews/ReviewsHeroArt";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l2.55 5.87 6.35.55-4.8 4.17 1.45 6.23L12 16.9l-5.55 2.92 1.45-6.23-4.8-4.17 6.35-.55L12 2.5Z" />
    </svg>
  );
}

type ReviewsHeroPanelProps = {
  totalReviews?: number;
};

export function ReviewsHeroPanel({ totalReviews }: ReviewsHeroPanelProps) {
  return (
    <section
      className="contact-hero-panel reviews-hero-panel"
      aria-label="Customer reviews"
    >
      <MarketingHeroBubbles />
      <span
        className="contact-hero-panel__glow contact-hero-panel__glow--1"
        aria-hidden
      />
      <span
        className="contact-hero-panel__glow contact-hero-panel__glow--2"
        aria-hidden
      />

      <div className="contact-hero-panel__content">
        <div className="contact-hero-panel__layout">
          <div className="contact-hero-panel__main">
            <div className="contact-hero-panel__header">
              <span className="contact-hero-panel__badge dashboard-pro-status dashboard-pro-status--brand">
                <StarIcon className="h-3.5 w-3.5 shrink-0" />
                Customer feedback
              </span>

              <h1 className="contact-hero-panel__title">
                Verified{" "}
                <span className="contact-hero-panel__accent">Reviews.</span>
              </h1>
            </div>

            <div className="contact-hero-panel__copy">
              <p className="contact-hero-panel__subheading">
                Read verified customer reviews across our digital products and
                categories.
              </p>

              {totalReviews && totalReviews > 0 ? (
                <div className="contact-hero-panel__meta">
                  <p className="contact-hero-panel__meta-item">
                    <StarIcon className="h-4 w-4 text-brand" />
                    <strong className="text-foreground">{totalReviews}</strong>{" "}
                    published customer review{totalReviews === 1 ? "" : "s"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <ReviewsHeroArt className="contact-hero-panel__art" />
        </div>
      </div>
    </section>
  );
}
