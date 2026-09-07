import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReplyTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;

  /** Staff-only internal note; ignored for customers. */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}
