import { IsEnum, IsOptional } from 'class-validator';
import { AffiliateCommissionStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryCommissionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AffiliateCommissionStatus)
  status?: AffiliateCommissionStatus;
}
