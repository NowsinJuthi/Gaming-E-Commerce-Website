import { IsString, MaxLength, MinLength } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  token!: string;
}
