import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WebsiteGuideStepDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  body?: string;
}

export class WebsiteIntroSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paragraphs?: string[];
}

export class WebsiteGuideSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebsiteGuideStepDto)
  steps?: WebsiteGuideStepDto[];
}

export class WebsitePricingPackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  priceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string;

  @IsOptional()
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  featuresHeading?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ctaHref?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateWebsiteSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  heroEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subheading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  offerTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  offerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  heroNoteTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  heroNoteText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  heroNoteSubtext?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebsiteIntroSectionDto)
  introSection?: WebsiteIntroSectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebsiteGuideSectionDto)
  guideSection?: WebsiteGuideSectionDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebsitePricingPackageDto)
  packages?: WebsitePricingPackageDto[];
}
