import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { ChatQuickReplyDto } from './chat-quick-reply.dto';

export class UpdateChatQuickRepliesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatQuickReplyDto)
  quickReplies!: ChatQuickReplyDto[];
}
