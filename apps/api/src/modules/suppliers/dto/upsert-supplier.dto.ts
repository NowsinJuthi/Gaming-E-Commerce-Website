import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SupplierCode, SupplierStatus } from '../../../common/enums';

export class UpsertSupplierDto {
  @IsEnum(SupplierCode)
  code!: SupplierCode;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedRegions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedCurrencies?: string[];
}
