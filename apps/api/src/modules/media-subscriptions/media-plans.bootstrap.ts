import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlanFeature, PlanTier, VideoQuality } from './media-subscription.types';
import { MediaPlansService } from './media-plans.service';
import { MediaPlan, MediaPlanDocument } from './schemas/media-plan.schema';
import { MediaSubscription, MediaSubscriptionDocument } from './schemas/media-subscription.schema';

/** Canonical Movie Server packages (BDT monthly prices match admin catalog). */
const DEFAULT_PLANS: Array<{
  slug: string;
  name: string;
  description: string;
  tier: PlanTier;
  rank: number;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxVideoQuality: VideoQuality;
  maxDevices: number;
  maxStreams: number;
  features: PlanFeature[];
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
}> = [
  {
    slug: 'basic',
    name: 'Basic',
    description: 'Watch on one device in standard definition.',
    tier: PlanTier.Basic,
    rank: 1,
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    maxVideoQuality: VideoQuality.Hd,
    maxDevices: 2,
    maxStreams: 1,
    features: [PlanFeature.Catalog, PlanFeature.Hd],
    trialDays: 60,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'standard',
    name: 'Standard',
    description: 'HD on two screens at once, plus downloads.',
    tier: PlanTier.Standard,
    rank: 2,
    monthlyPriceCents: 6900,
    yearlyPriceCents: 69000,
    maxVideoQuality: VideoQuality.Hd,
    maxDevices: 3,
    maxStreams: 2,
    features: [PlanFeature.Catalog, PlanFeature.Hd, PlanFeature.Downloads],
    trialDays: 60,
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'premium',
    name: 'Premium',
    description: 'Ultra HD, four simultaneous streams, HDR and spatial audio.',
    tier: PlanTier.Premium,
    rank: 3,
    monthlyPriceCents: 9900,
    yearlyPriceCents: 99000,
    maxVideoQuality: VideoQuality.Uhd,
    maxDevices: 6,
    maxStreams: 4,
    features: [
      PlanFeature.Catalog,
      PlanFeature.Hd,
      PlanFeature.Uhd,
      PlanFeature.Downloads,
      PlanFeature.Hdr,
      PlanFeature.SpatialAudio,
    ],
    trialDays: 56,
    isActive: true,
    sortOrder: 3,
  },
];

@Injectable()
export class MediaPlansBootstrap implements OnModuleInit {
  private readonly logger = new Logger(MediaPlansBootstrap.name);

  constructor(
    @InjectModel(MediaPlan.name) private readonly planModel: Model<MediaPlanDocument>,
    @InjectModel(MediaSubscription.name)
    private readonly subModel: Model<MediaSubscriptionDocument>,
    private readonly plans: MediaPlansService,
  ) {}

  async onModuleInit(): Promise<void> {
    const currency = this.plans.defaultCurrency();

    for (const plan of DEFAULT_PLANS) {
      await this.planModel.updateOne(
        { slug: plan.slug },
        { $set: { ...plan, currency } },
        { upsert: true },
      );
    }
    this.logger.log(`Ensured Basic, Standard, and Premium media plans (${currency}).`);

    const [plans, subs] = await Promise.all([
      this.planModel.updateMany({ currency: 'USD' }, { $set: { currency } }),
      this.subModel.updateMany({ currency: 'USD' }, { $set: { currency } }),
    ]);
    if (plans.modifiedCount > 0 || subs.modifiedCount > 0) {
      this.logger.log(
        `Updated legacy USD media pricing to ${currency} (${plans.modifiedCount} plans, ${subs.modifiedCount} subscriptions).`,
      );
    }
  }
}
