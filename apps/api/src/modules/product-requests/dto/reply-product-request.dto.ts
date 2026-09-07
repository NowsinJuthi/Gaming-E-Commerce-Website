import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyProductRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;
}
