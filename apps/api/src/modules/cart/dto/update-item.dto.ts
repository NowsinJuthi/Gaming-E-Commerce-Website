import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateItemDto {
  /** A quantity of 0 removes the item from the cart. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;

  /** Disambiguates which variation line to update when a product has several. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  variationValueId?: string;
}
