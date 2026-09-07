import {
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ResellerStatus, ResellerTier } from '../../../common/enums';

export class UpdateResellerDto {
  @IsOptional()
  @IsEnum(ResellerStatus)
  status?: ResellerStatus;

  @IsOptional()
  @IsEnum(ResellerTier)
  tier?: ResellerTier;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discountRate?: number;
}
