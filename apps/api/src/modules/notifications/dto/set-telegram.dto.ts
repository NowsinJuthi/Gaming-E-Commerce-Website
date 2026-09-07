import { IsString, MaxLength } from 'class-validator';

export class SetTelegramDto {
  /** Pass an empty string to remove the Telegram chat ID. */
  @IsString()
  @MaxLength(64)
  chatId!: string;
}
