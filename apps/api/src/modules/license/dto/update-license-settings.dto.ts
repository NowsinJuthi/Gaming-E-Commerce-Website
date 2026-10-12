import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Internal DTO — only licenseKey is accepted from HTTP; vendor fields are server env only. */
export class UpdateLicenseSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  installationId?: string;
}
