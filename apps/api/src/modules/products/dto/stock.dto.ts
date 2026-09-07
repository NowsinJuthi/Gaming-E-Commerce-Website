import { IsNumber, IsOptional, Min } from 'class-validator';

export class StockDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  available?: number;
}
