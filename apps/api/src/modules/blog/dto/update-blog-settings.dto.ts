import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class UpdateBlogPageFeaturesDto {
  @IsOptional()
  @IsBoolean()
  reactionsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  viewsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  authorProfileEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shareButtonsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  readingTimeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  relatedPostsEnabled?: boolean;
}

export class UpdateBlogSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBlogPageFeaturesDto)
  features?: UpdateBlogPageFeaturesDto;
}
