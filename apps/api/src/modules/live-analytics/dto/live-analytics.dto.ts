import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VisitorPingDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  visitorKey!: string;

  @IsString()
  @MaxLength(240)
  path!: string;
}

export class MediaWatchDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  visitorKey!: string;

  @IsString()
  @MaxLength(64)
  titleId!: string;

  @IsString()
  @MaxLength(200)
  titleName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  episodeName?: string;
}

export class MediaIdleDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  visitorKey!: string;
}
