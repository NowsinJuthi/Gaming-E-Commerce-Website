import { IsEnum, IsMongoId, IsObject, IsOptional } from 'class-validator';
import { NotificationAudience, NotificationEvent } from '../../../common/enums';

export class DispatchNotificationDto {
  @IsMongoId()
  userId!: string;

  @IsEnum(NotificationEvent)
  event!: NotificationEvent;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationAudience)
  audience?: NotificationAudience;
}
