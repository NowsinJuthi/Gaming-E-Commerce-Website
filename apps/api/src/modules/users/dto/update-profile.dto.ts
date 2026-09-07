import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Absolute http(s) URLs or site-relative paths (e.g. /api/uploads/avatars/...). */
const AVATAR_URL_PATTERN = /^https?:\/\/.+|^\/.+/;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsString()
  @MaxLength(2048)
  @Matches(AVATAR_URL_PATTERN, {
    message: 'avatarUrl must be a valid URL or site path',
  })
  avatarUrl?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
