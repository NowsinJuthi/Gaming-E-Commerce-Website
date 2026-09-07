import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AccessBlockType } from '../../database/schemas/access-block.schema';

export class QueryAccessBlocksDto extends PaginationDto {
  @IsOptional()
  @IsIn(['ip', 'country'])
  type?: AccessBlockType;
}
