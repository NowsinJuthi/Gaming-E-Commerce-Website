import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AffiliateStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAffiliatesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @IsOptional()
  @IsString()
  q?: string;
}
