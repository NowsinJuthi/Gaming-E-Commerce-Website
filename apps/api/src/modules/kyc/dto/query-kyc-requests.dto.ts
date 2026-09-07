import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { KycStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryKycRequestsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(KycStatus)
  status?: KycStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
