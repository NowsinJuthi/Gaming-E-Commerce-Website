import { IsBoolean, IsMongoId } from 'class-validator';

export class TypingDto {
  @IsMongoId()
  roomId!: string;

  @IsBoolean()
  isTyping!: boolean;
}
