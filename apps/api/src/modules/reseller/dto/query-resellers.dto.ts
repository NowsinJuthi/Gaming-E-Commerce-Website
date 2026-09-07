import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ResellerStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryResellersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ResellerStatus)
  status?: ResellerStatus;

  @IsOptional()
  @IsString()
  q?: string;
}
