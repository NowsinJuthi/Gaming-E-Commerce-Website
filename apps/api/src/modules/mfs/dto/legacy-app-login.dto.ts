import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Paymently.apk login payload — accepts device metadata the app sends on every login.
 * Unknown extra fields are stripped (whitelist); only listed properties are kept.
 */
export class LegacyAppLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;

  @IsOptional()
  @IsString()
  fcm_token?: string;

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  device_name?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  device_model?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  android_version?: string;

  @IsOptional()
  @IsString()
  androidVersion?: string;

  @IsOptional()
  @IsString()
  app_version?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
