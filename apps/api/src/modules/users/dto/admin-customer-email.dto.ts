import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminCustomerEmailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
