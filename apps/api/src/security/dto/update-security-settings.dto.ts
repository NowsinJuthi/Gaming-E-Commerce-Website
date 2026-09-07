import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ThrottleSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10_000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1_000)
  @Max(3_600_000)
  ttlMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1_000)
  @Max(3_600_000)
  blockMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  registerLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  loginLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  otpLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1_000)
  @Max(3_600_000)
  authTtlMs?: number;
}

class RecaptchaSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  siteKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secretKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;
}

class CloudflareSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  trustProxyHops?: number;

  @IsOptional()
  @IsBoolean()
  requireHeaders?: boolean;
}

class ActivitySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(7)
  @Max(365)
  retentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  sampleRate?: number;
}

class HelmetSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(63_072_000)
  hstsMaxAgeSeconds?: number;
}

class AuditSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ThrottleSettingsDto)
  throttle?: ThrottleSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecaptchaSettingsDto)
  recaptcha?: RecaptchaSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CloudflareSettingsDto)
  cloudflare?: CloudflareSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActivitySettingsDto)
  activity?: ActivitySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HelmetSettingsDto)
  helmet?: HelmetSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuditSettingsDto)
  audit?: AuditSettingsDto;
}
