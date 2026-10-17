import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PLAN_FEATURES,
  PLAN_TIERS,
  PlanFeature,
  PlanTier,
  VIDEO_QUALITIES,
  VideoQuality,
} from '../media-subscription.types';

export class AdminUpsertMediaPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase kebab-case.' })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(400)
  description!: string;

  @IsIn([...PLAN_TIERS])
  tier!: PlanTier;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rank?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsInt()
  @Min(0)
  monthlyPriceCents!: number;

  @IsInt()
  @Min(0)
  yearlyPriceCents!: number;

  @IsIn([...VIDEO_QUALITIES])
  maxVideoQuality!: VideoQuality;

  @IsInt()
  @Min(1)
  @Max(20)
  maxDevices!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxStreams!: number;

  @IsIn([...PLAN_FEATURES], { each: true })
  features!: PlanFeature[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  featureBullets?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class AdminUpdateMediaPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsIn([...PLAN_TIERS])
  tier?: PlanTier;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rank?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearlyPriceCents?: number;

  @IsOptional()
  @IsIn([...VIDEO_QUALITIES])
  maxVideoQuality?: VideoQuality;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDevices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxStreams?: number;

  @IsOptional()
  @IsIn([...PLAN_FEATURES], { each: true })
  features?: PlanFeature[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  featureBullets?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}
