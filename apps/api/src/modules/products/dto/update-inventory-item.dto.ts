import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  value?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}
