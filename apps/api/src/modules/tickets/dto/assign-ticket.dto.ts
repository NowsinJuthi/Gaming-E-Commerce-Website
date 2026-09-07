import { IsMongoId } from 'class-validator';

export class AssignTicketDto {
  @IsMongoId()
  adminId!: string;
}
