import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveMfsIntentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
