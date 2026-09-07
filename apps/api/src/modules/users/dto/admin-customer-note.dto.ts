import { IsString, MaxLength } from 'class-validator';

export class AdminCustomerNoteDto {
  @IsString()
  @MaxLength(4000)
  note!: string;
}
