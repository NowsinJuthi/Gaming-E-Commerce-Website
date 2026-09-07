import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

// Allow clearing a URL field by sending an empty string.
const urlOpts = { require_tld: false } as const;

export class SeoDto {
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  metaDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsUrl(urlOpts)
  canonicalUrl?: string;

  @IsOptional()
  @IsUrl(urlOpts)
  ogImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  ogTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ogDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  twitterTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  twitterDescription?: string;

  @IsOptional()
  @IsUrl(urlOpts)
  twitterImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  metaRobots?: string;
}
