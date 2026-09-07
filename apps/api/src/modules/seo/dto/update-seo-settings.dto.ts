import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class GlobalSeoUpdateDto {
  @IsOptional() @IsString() @MaxLength(200) siteTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) siteDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(255) canonicalDomain?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsString() @MaxLength(255) googleVerification?: string;
  @IsOptional() @IsString() @MaxLength(255) bingVerification?: string;
  @IsOptional() @IsString() @MaxLength(60) googleAnalyticsId?: string;
  @IsOptional() @IsString() @MaxLength(60) gtmId?: string;
  @IsOptional() @IsString() @MaxLength(60) facebookPixelId?: string;
}

export class HomepageSeoUpdateDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(200) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() @MaxLength(500) ogImage?: string;
}

export class SocialSeoUpdateDto {
  @IsOptional() @IsString() @MaxLength(255) facebook?: string;
  @IsOptional() @IsString() @MaxLength(255) instagram?: string;
  @IsOptional() @IsString() @MaxLength(255) youtube?: string;
  @IsOptional() @IsString() @MaxLength(255) twitter?: string;
  @IsOptional() @IsString() @MaxLength(255) discord?: string;
}

export class FaqItemUpdateDto {
  @IsOptional() @IsString() @MaxLength(300) question?: string;
  @IsOptional() @IsString() @MaxLength(2000) answer?: string;
}

export class SchemaSeoUpdateDto {
  @IsOptional() @IsBoolean() organization?: boolean;
  @IsOptional() @IsBoolean() website?: boolean;
  @IsOptional() @IsBoolean() product?: boolean;
  @IsOptional() @IsBoolean() faq?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemUpdateDto)
  faqItems?: FaqItemUpdateDto[];
}

export class StaticPageSeoUpdateDto {
  @IsString() @MaxLength(255) path!: string;
  @IsString() @MaxLength(80) label!: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(200) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() @MaxLength(500) ogImage?: string;
  @IsOptional() @IsBoolean() noIndex?: boolean;
}

export class UpdateSeoSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GlobalSeoUpdateDto)
  global?: GlobalSeoUpdateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomepageSeoUpdateDto)
  homepage?: HomepageSeoUpdateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialSeoUpdateDto)
  social?: SocialSeoUpdateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchemaSeoUpdateDto)
  schema?: SchemaSeoUpdateDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaticPageSeoUpdateDto)
  staticPages?: StaticPageSeoUpdateDto[];

  @IsOptional()
  @IsBoolean()
  autoGenerateProductSeo?: boolean;
}
