export const BillingCycle = {
  Monthly: "monthly",
  Yearly: "yearly",
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];
export const BILLING_CYCLES = [BillingCycle.Monthly, BillingCycle.Yearly] as const;

export const PlanTier = {
  Basic: "basic",
  Standard: "standard",
  Premium: "premium",
} as const;

export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];
export const PLAN_TIERS = [PlanTier.Basic, PlanTier.Standard, PlanTier.Premium] as const;

export const VideoQuality = {
  Sd: "sd",
  Hd: "hd",
  Uhd: "uhd",
} as const;

export type VideoQuality = (typeof VideoQuality)[keyof typeof VideoQuality];
export const VIDEO_QUALITIES = [VideoQuality.Sd, VideoQuality.Hd, VideoQuality.Uhd] as const;

export const SubscriptionStatus = {
  Pending: "pending",
  Trial: "trial",
  Active: "active",
  Cancelled: "cancelled",
  Expired: "expired",
  Suspended: "suspended",
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Pending,
  SubscriptionStatus.Trial,
  SubscriptionStatus.Active,
  SubscriptionStatus.Cancelled,
  SubscriptionStatus.Expired,
  SubscriptionStatus.Suspended,
] as const;

export const PlanFeature = {
  Catalog: "catalog",
  Hd: "hd",
  Uhd: "uhd",
  Downloads: "downloads",
  Hdr: "hdr",
  SpatialAudio: "spatial_audio",
} as const;

export type PlanFeature = (typeof PlanFeature)[keyof typeof PlanFeature];
export const PLAN_FEATURES = [
  PlanFeature.Catalog,
  PlanFeature.Hd,
  PlanFeature.Uhd,
  PlanFeature.Downloads,
  PlanFeature.Hdr,
  PlanFeature.SpatialAudio,
] as const;

export type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  tier: PlanTier;
  rank: number;
  currency: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxVideoQuality: VideoQuality;
  maxDevices: number;
  maxStreams: number;
  features: PlanFeature[];
  featureBullets: string[];
  featuresHeading: string;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
};

export type PublicSubscription = {
  id: string;
  userId: string;
  plan: PublicPlan;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currency: string;
  priceCents: number;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  cancelledAt: string | null;
  endedAt: string | null;
  gracePeriodEndsAt: string | null;
  scheduledPlanId: string | null;
  scheduledBillingCycle: BillingCycle | null;
  scheduledChangeAt: string | null;
  paymentProvider: string;
  externalPaymentRef: string | null;
  lastRenewedAt: string | null;
  isCurrent: boolean;
  entitled: boolean;
};

export type PublicSubscriptionEvent = {
  id: string;
  subscriptionId: string;
  type: string;
  fromPlanSlug: string | null;
  toPlanSlug: string | null;
  fromStatus: SubscriptionStatus | null;
  toStatus: SubscriptionStatus | null;
  billingCycle: BillingCycle | null;
  note: string | null;
  createdAt: string;
};

export type SubscriptionEntitlement = {
  entitled: boolean;
  status: SubscriptionStatus | null;
  planSlug: string | null;
  currentPeriodEnd: string | null;
};

export type AdminSubscriptionRow = PublicSubscription & {
  userEmail: string;
  userDisplayName: string;
  deviceCount: number;
  streamCount: number;
  maxDevices: number;
  maxStreams: number;
};
