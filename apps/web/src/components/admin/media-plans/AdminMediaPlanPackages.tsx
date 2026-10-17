"use client";

import { PlanTier, type PublicPlan } from "@/lib/media-subscription-types";
import { formatMediaPlanCents } from "@/lib/media-subscription-api";
import { PlanTierIcon, planVisualVariant } from "@/components/customer/media-subscription/plan-tier-icons";
import themeStyles from "@/components/customer/media-subscription/media-subscription-theme.module.css";
import styles from "./admin-media-plans.module.css";

function isFeatured(plan: PublicPlan, plans: PublicPlan[]): boolean {
  if (plan.tier === PlanTier.Standard) return true;
  if (plans.length === 3) {
    const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted[1]?.id === plan.id;
  }
  return false;
}

export function AdminMediaPlanPackages({ plans }: { plans: PublicPlan[] }) {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!sorted.length) return null;

  return (
    <section className={styles.card} aria-label="Live subscription packages">
      <p className={styles.previewHeading}>Storefront packages</p>
      <div className={`${themeStyles.root} ${styles.previewGrid}`}>
        {sorted.map((plan) => {
          const featured = isFeatured(plan, sorted);
          const variant = planVisualVariant(plan.tier);
          return (
            <article
              key={plan.id}
              className={`${styles.packageCard} ${featured ? styles.packageFeatured : ""} ${
                plan.isActive ? "" : styles.packageInactive
              }`}
            >
              {featured ? <span className={styles.packageBadge}>Popular</span> : null}
              {!plan.isActive ? (
                <span className={styles.packageBadge} style={{ right: "auto", left: "0.75rem" }}>
                  Disabled
                </span>
              ) : null}
              <div className="flex justify-center">
                <PlanTierIcon variant={variant} featured={featured} />
              </div>
              <p className={`${styles.packageName} mt-3 text-center`}>{plan.name}</p>
              <p className={styles.packageDesc}>{plan.description}</p>
              <p className={`${styles.packagePrice} text-center tabular-nums`}>
                {formatMediaPlanCents(plan.monthlyPriceCents, plan.currency)}
                <span className={styles.packagePriceLabel}>per month</span>
              </p>
              {plan.trialDays > 0 ? (
                <p className={`${styles.packageTrial} text-center`}>
                  {plan.trialDays}-day free trial for new accounts
                </p>
              ) : null}
              <p className={styles.packageLimits}>
                {plan.maxVideoQuality.toUpperCase()} · {plan.maxStreams} stream
                {plan.maxStreams === 1 ? "" : "s"} · {plan.maxDevices} device
                {plan.maxDevices === 1 ? "" : "s"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
