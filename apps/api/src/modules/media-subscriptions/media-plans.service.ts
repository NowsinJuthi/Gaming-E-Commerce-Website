import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PLAN_TIER_RANK, PlanTier } from './media-subscription.types';
import { normalizeFeatureBullets } from './plan.util';
import { AdminUpdateMediaPlanDto, AdminUpsertMediaPlanDto } from './dto/admin-plan.dto';
import { MediaPlan, MediaPlanDocument } from './schemas/media-plan.schema';
import { toPublicPlan } from './subscription.mapper';

@Injectable()
export class MediaPlansService {
  constructor(
    @InjectModel(MediaPlan.name) private readonly planModel: Model<MediaPlanDocument>,
    private readonly config: ConfigService,
  ) {}

  listActive() {
    return this.planModel.find({ isActive: true }).sort({ sortOrder: 1, rank: 1 }).exec();
  }

  listAll() {
    return this.planModel.find().sort({ sortOrder: 1, rank: 1 }).exec();
  }

  findBySlug(slug: string) {
    return this.planModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.planModel.findById(id).exec();
  }

  async getActiveBySlug(slug: string): Promise<MediaPlanDocument> {
    const plan = await this.findBySlug(slug);
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found.');
    }
    return plan;
  }

  async getById(id: string): Promise<MediaPlanDocument> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }
    return plan;
  }

  defaultCurrency(): string {
    return (
      this.config.get<string>('MEDIA_SUBSCRIPTION_DEFAULT_CURRENCY') ??
      this.config.get<string>('SUBSCRIPTION_DEFAULT_CURRENCY') ??
      'BDT'
    ).toUpperCase();
  }

  async create(dto: AdminUpsertMediaPlanDto): Promise<MediaPlanDocument> {
    return this.planModel.create({
      ...dto,
      slug: dto.slug.toLowerCase(),
      currency: (dto.currency ?? this.defaultCurrency()).toUpperCase(),
      rank: dto.rank ?? PLAN_TIER_RANK[dto.tier],
      features: dto.features ?? [],
      featureBullets: normalizeFeatureBullets(dto.featureBullets),
      trialDays: dto.trialDays ?? 0,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? PLAN_TIER_RANK[dto.tier],
    });
  }

  async update(id: string, dto: AdminUpdateMediaPlanDto): Promise<MediaPlanDocument> {
    const plan = await this.getById(id);
    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.tier !== undefined) plan.tier = dto.tier;
    if (dto.rank !== undefined) {
      plan.rank = dto.rank;
    } else if (dto.tier !== undefined) {
      plan.rank = PLAN_TIER_RANK[dto.tier];
    }
    if (dto.currency !== undefined) plan.currency = dto.currency.toUpperCase();
    if (dto.monthlyPriceCents !== undefined) plan.monthlyPriceCents = dto.monthlyPriceCents;
    if (dto.yearlyPriceCents !== undefined) plan.yearlyPriceCents = dto.yearlyPriceCents;
    if (dto.maxVideoQuality !== undefined) plan.maxVideoQuality = dto.maxVideoQuality;
    if (dto.maxDevices !== undefined) plan.maxDevices = dto.maxDevices;
    if (dto.maxStreams !== undefined) plan.maxStreams = dto.maxStreams;
    if (dto.features !== undefined) plan.features = dto.features;
    if (dto.featureBullets !== undefined) {
      plan.featureBullets = normalizeFeatureBullets(dto.featureBullets);
    }
    if (dto.trialDays !== undefined) plan.trialDays = dto.trialDays;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;
    await plan.save();
    return plan;
  }

  async deactivate(id: string): Promise<MediaPlanDocument> {
    const plan = await this.getById(id);
    plan.isActive = false;
    await plan.save();
    return plan;
  }

  toPublic = toPublicPlan;

  defaultRank(tier: PlanTier): number {
    return PLAN_TIER_RANK[tier];
  }
}
