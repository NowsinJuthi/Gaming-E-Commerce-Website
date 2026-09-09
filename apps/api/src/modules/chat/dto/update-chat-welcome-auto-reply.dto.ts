import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChatWelcomeAutoReplyDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;
}
