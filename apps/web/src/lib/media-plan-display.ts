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
};

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
