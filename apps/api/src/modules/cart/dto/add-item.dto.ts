import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartCustomerInputDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @MaxLength(2000)
  value!: string;
}

export class AddItemDto {
  @IsMongoId()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  variationValueId?: string;

  /** Buyer-provided values for the product's custom input fields. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartCustomerInputDto)
  customerInputs?: CartCustomerInputDto[];
}
