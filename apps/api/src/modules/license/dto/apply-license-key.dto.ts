import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApplyLicenseKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  licenseKey!: string;
}
