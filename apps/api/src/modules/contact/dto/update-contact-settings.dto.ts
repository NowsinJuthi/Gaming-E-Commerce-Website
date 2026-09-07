import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ContactSocialLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;
}

export class ContactAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lines?: string[];
}

export class ContactSupportDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phones?: string[];
}

export class ContactEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emails?: string[];
}

export class ContactSocialDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactSocialLinkDto)
  links?: ContactSocialLinkDto[];
}

export class ContactWhatsappCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateContactSettingsDto {
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
  @MaxLength(500)
  extraText?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactAddressDto)
  address?: ContactAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactSupportDto)
  support?: ContactSupportDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactEmailDto)
  email?: ContactEmailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactSocialDto)
  social?: ContactSocialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactWhatsappCardDto)
  whatsappCard?: ContactWhatsappCardDto;
}
