"use client";

import {
  BillingCycle,
  PlanTier,
  type PublicPlan,
} from "@/lib/media-subscription-types";
import { buildPlanFeatureLines } from "@/lib/media-plan-display";
import { formatMediaPlanCents } from "@/lib/media-subscription-api";
import { PlanTierIcon, planVisualVariant, type PlanVisualVariant } from "./plan-tier-icons";
import styles from "./subscribe-pricing.module.css";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const TIER_TAGLINE: Record<PlanVisualVariant, string> = {
  basic: "Perfect for solo viewing on a few devices",
  standard: "Best balance for families and shared accounts",
  premium: "Maximum quality, streams, and premium extras",
};

function isFeaturedPlan(plan: PublicPlan, plans: PublicPlan[]): boolean {
  if (plan.tier === PlanTier.Standard) return true;
  if (plans.length === 3) {
    const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted[1]?.id === plan.id;
  }
  return false;
}

function planBadge(plan: PublicPlan, featured: boolean): string | null {
  if (featured) return "Popular";
  if (plan.tier === PlanTier.Premium) return "Premium";
  return null;
}

export function SubscribePricingSection({
  plans,
  cycle,
  onCycleChange,
  error,
  currentSlug,
  entitled,
  busy,
  onSelectPlan,
  layout = "account",
}: {
  plans: PublicPlan[];
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  error: string | null;
  currentSlug?: string;
  entitled: boolean;
  busy: boolean;
  onSelectPlan: (slug: string) => void;
  layout?: "subscribe" | "account";
}) {
  const hasCurrentPlan = Boolean(currentSlug);

  return (
    <section
      className={cn(styles.pricing, layout === "account" && styles.pricingAccount)}
      aria-labelledby={layout === "account" ? "account-plans-heading" : undefined}
    >
      <div className={styles.gridBg} aria-hidden />

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          {layout === "account" ? "Plans & billing" : "Subscription plans"}
        </p>
        {layout === "account" ? (
          <>
            <h2 id="account-plans-heading" className={styles.title}>
              Pick your plan — current choice is highlighted
            </h2>
            <p className={styles.subtitle}>
              The card marked <strong className={styles.subtitleStrong}>Your plan</strong> is what
              your account uses today. Switch anytime; upgrades apply immediately, downgrades at
              period end when scheduled.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Choose a plan that fits your library</h1>
            <p className={styles.subtitle}>
              Access is authorized on the server. The plan you pick here is verified again before
              every playback request.
            </p>
          </>
        )}

        <div className={styles.cycleWrap}>
          <div className={styles.cycleToggle} role="group" aria-label="Billing cycle">
            <button
              type="button"
              className={cn(styles.cycleBtn, cycle === BillingCycle.Monthly && styles.cycleBtnActive)}
              onClick={() => onCycleChange(BillingCycle.Monthly)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(styles.cycleBtn, cycle === BillingCycle.Yearly && styles.cycleBtnActive)}
              onClick={() => onCycleChange(BillingCycle.Yearly)}
            >
              Yearly
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className={styles.alertWrap}>
          <p className="max-w-xl rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-300">
            {error}
          </p>
        </div>
      ) : null}

      <div className={styles.cards}>
        {plans.map((plan) => {
          const variant = planVisualVariant(plan.tier);
          const featured = isFeaturedPlan(plan, plans);
          const badge = planBadge(plan, featured);
          const price =
            cycle === BillingCycle.Yearly ? plan.yearlyPriceCents : plan.monthlyPriceCents;
          const isCurrent = hasCurrentPlan && currentSlug === plan.slug;
          const features = buildPlanFeatureLines(plan);
          const displayBadge = isCurrent ? "Your plan" : badge;

          return (
            <article
              key={plan.id}
              className={cn(
                styles.card,
                featured && !isCurrent && styles.cardFeatured,
                isCurrent && styles.cardCurrent,
              )}
              aria-current={isCurrent ? "true" : undefined}
            >
              {isCurrent ? <span className={styles.currentGlow} aria-hidden /> : null}
              {displayBadge ? (
                <span className={cn(styles.badge, isCurrent && styles.badgeCurrent)}>
                  {displayBadge}
                </span>
              ) : null}

              <div className={styles.cardTop}>
                <PlanTierIcon variant={variant} featured={featured} />
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planTagline}>
                  {plan.description?.trim() || TIER_TAGLINE[variant]}
                </p>
              </div>

              <div className={styles.priceWrap}>
                <p className={styles.price}>{formatMediaPlanCents(price, plan.currency)}</p>
                <span className={styles.priceLabel}>
                  per {cycle === BillingCycle.Yearly ? "year" : "month"}
                </span>
              </div>

              {plan.trialDays > 0 ? (
                <p className={styles.trialNote}>{plan.trialDays}-day free trial for new accounts</p>
              ) : null}

              <div className={styles.features}>
                <p className={styles.featuresHeading}>All features</p>
                <ul className={styles.featureList}>
                  {features.map((line) => (
                    <li key={line} className={styles.featureItem}>
                      <span className={styles.check} aria-hidden>
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                          <path
                            d="M3.5 8.2 6.4 11l6.1-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className={cn(styles.cta, isCurrent && styles.ctaCurrent)}
                disabled={busy || isCurrent}
                aria-label={
                  isCurrent
                    ? `${plan.name} is your current plan`
                    : entitled
                      ? `Switch to ${plan.name}`
                      : `Get started with ${plan.name}`
                }
                onClick={() => onSelectPlan(plan.slug)}
              >
                {isCurrent ? (
                  <span className={styles.ctaCheck} aria-hidden>
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                      <path
                        d="M3.5 8.2 6.4 11l6.1-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="inline-flex opacity-90" aria-hidden>
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path
                        d="M4 10h12M12 6l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
                {isCurrent ? "Active on your account" : entitled ? "Switch to this plan" : "Get started"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
