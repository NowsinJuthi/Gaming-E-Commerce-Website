import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTicketsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  /** Staff only: limit to tickets assigned to the requesting agent. */
  @IsOptional()
  @IsBooleanString()
  assignedToMe?: string;
}
