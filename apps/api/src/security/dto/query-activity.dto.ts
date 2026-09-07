import { IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryActivityDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;
}
