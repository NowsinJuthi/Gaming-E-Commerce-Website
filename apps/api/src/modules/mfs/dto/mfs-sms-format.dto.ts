import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MfsProvider } from '../../../common/enums';

export class MfsSmsProviderFormatDto {
  @IsEnum(MfsProvider)
  provider!: MfsProvider;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectPatterns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trxIdPatterns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amountPatterns?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  sampleSms?: string;
}

export class UpdateMfsSmsFormatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MfsSmsProviderFormatDto)
  providers!: MfsSmsProviderFormatDto[];
}

export class TestMfsSmsFormatDto {
  @IsString()
  @MaxLength(4000)
  sms!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sender?: string;
}
