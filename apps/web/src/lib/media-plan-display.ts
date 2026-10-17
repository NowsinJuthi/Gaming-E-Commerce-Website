import {
  PlanFeature,
  type PlanFeature as PlanFeatureType,
  type VideoQuality,
} from "@/lib/media-subscription-types";

export const PLAN_FEATURE_LABELS: Record<PlanFeatureType, string> = {
  [PlanFeature.Catalog]: "Full catalog access",
  [PlanFeature.Hd]: "HD streaming included",
  [PlanFeature.Uhd]: "Ultra HD (4K) streaming",
  [PlanFeature.Downloads]: "Offline downloads",
  [PlanFeature.Hdr]: "HDR playback",
  [PlanFeature.SpatialAudio]: "Spatial audio",
};

export type PlanFeatureLineInput = {
  maxVideoQuality: VideoQuality;
  maxStreams: number;
  maxDevices: number;
  features: PlanFeatureType[];
  featureBullets?: string[];
  featuresHeading?: string;
};

export function featureBulletsToText(bullets: string[]): string {
  return bullets.join("\n");
}

export function textToFeatureBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function planFeaturesHeading(plan: { featuresHeading?: string }): string {
  const trimmed = plan.featuresHeading?.trim();
  return trimmed || "All features";
}

export function buildPlanFeatureLines(plan: PlanFeatureLineInput): string[] {
  const custom = (plan.featureBullets ?? []).map((line) => line.trim()).filter(Boolean);
  if (custom.length > 0) {
    return custom;
  }

  const lines = [
    `Up to ${plan.maxVideoQuality.toUpperCase()} video quality`,
    `${plan.maxStreams} simultaneous stream${plan.maxStreams === 1 ? "" : "s"}`,
    `${plan.maxDevices} registered device${plan.maxDevices === 1 ? "" : "s"}`,
  ];
  for (const feature of Object.values(PlanFeature)) {
    if (plan.features.includes(feature)) {
      lines.push(PLAN_FEATURE_LABELS[feature]);
    }
  }
  return lines;
}
