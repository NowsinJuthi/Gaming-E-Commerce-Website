import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveRobotsDto {
  @IsString()
  @MaxLength(20_000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  useCustom?: boolean;
}

export class ValidateRobotsDto {
  @IsString()
  @MaxLength(20_000)
  content!: string;
}
