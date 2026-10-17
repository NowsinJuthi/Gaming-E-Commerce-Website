import { PlanTier, type PlanTier as PlanTierType } from "@/lib/media-subscription-types";
import styles from "./subscribe-pricing.module.css";

export type PlanVisualVariant = "basic" | "standard" | "premium";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function planVisualVariant(tier: PlanTierType): PlanVisualVariant {
  if (tier === PlanTier.Basic) return "basic";
  if (tier === PlanTier.Premium) return "premium";
  return "standard";
}

function BasicPlanIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.iconSvg} aria-hidden>
      <rect
        className={styles.iconStarterScreen}
        x="11"
        y="14"
        width="26"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="2.25"
      />
      <path
        d="M18 36h12M16 32h16"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="17" cy="20" r="1.5" fill="currentColor" />
      <path
        className={styles.iconStarterLine}
        d="M21 26h12M21 22h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className={styles.iconStarterSpark}
        d="M36 12l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2 1.2-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StandardPlanIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.iconSvg} aria-hidden>
      <rect x="10" y="16" width="14" height="22" rx="2" stroke="currentColor" strokeWidth="2.25" />
      <path d="M14 21h6M14 26h6M14 31h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect
        className={styles.iconBusinessBar1}
        x="28"
        y="28"
        width="5"
        height="10"
        rx="1.2"
        fill="currentColor"
      />
      <rect
        className={styles.iconBusinessBar2}
        x="35"
        y="22"
        width="5"
        height="16"
        rx="1.2"
        fill="currentColor"
      />
      <path
        className={styles.iconBusinessTrend}
        d="M27 18l5-4 4 3 6-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className={styles.iconBusinessSpark} cx="38" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function PremiumPlanIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={styles.iconSvg} aria-hidden>
      <path
        className={styles.iconEnterpriseCrown}
        d="M12 20 16 14l8 6 8-6 4 6v14H12V20Z"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path d="M24 14v4M20 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect
        className={styles.iconEnterpriseLayer1}
        x="14"
        y="28"
        width="20"
        height="4"
        rx="1"
        fill="currentColor"
      />
      <rect
        className={styles.iconEnterpriseLayer2}
        x="16"
        y="34"
        width="16"
        height="3"
        rx="1"
        fill="currentColor"
      />
      <circle className={styles.iconEnterpriseOrbit} cx="36" cy="16" r="2" fill="currentColor" />
      <path
        className={styles.iconEnterpriseStar}
        d="M8 30l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlanTierIcon({
  variant,
  featured,
}: {
  variant: PlanVisualVariant;
  featured: boolean;
}) {
  return (
    <span
      className={cn(
        styles.planIcon,
        styles[`planIcon--${variant}`],
        featured && styles.planIconFeatured,
      )}
      aria-hidden
    >
      <span className={styles.planIconRing} />
      <span className={cn(styles.planIconRing, styles.planIconRing2)} />
      {variant === "basic" ? <BasicPlanIcon /> : null}
      {variant === "standard" ? <StandardPlanIcon /> : null}
      {variant === "premium" ? <PremiumPlanIcon /> : null}
    </span>
  );
}
