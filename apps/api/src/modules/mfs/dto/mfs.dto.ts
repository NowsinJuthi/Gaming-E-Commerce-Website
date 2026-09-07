import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MfsProvider } from '../../../common/enums';

export class CreateMfsGatewayDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(MfsProvider)
  provider!: MfsProvider;

  @IsString()
  @MaxLength(20)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  qrCodeUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class UpdateMfsGatewayDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(MfsProvider)
  provider?: MfsProvider;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  qrCodeUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class SelectMfsGatewayDto {
  @IsString()
  gatewayId!: string;
}

export class SubmitMfsTrxDto {
  @IsString()
  @MaxLength(64)
  trxId!: string;
}

export class UpdateMfsCheckoutItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
