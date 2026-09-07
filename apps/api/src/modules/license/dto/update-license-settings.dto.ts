import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLicenseSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  websiteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  installationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  siteSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  apiUrl?: string;
}
