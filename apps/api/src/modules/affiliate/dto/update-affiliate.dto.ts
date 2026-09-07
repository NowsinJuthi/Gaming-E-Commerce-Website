import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AffiliateStatus } from '../../../common/enums';

export class UpdateAffiliateDto {
  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;
}
