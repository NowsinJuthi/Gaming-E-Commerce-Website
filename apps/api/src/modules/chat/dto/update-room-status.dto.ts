import { IsEnum } from 'class-validator';
import { ChatRoomStatus } from '../../../common/enums';

export class UpdateRoomStatusDto {
  @IsEnum(ChatRoomStatus)
  status!: ChatRoomStatus;
}
