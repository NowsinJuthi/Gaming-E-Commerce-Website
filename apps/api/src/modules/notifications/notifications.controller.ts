import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  ListNotificationsDto,
  NotificationAudienceDto,
} from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsDto,
  ) {
    const { audience, excludeChat, ...pagination } = query;
    return this.notifications.listForUser(
      userId,
      pagination,
      audience,
      excludeChat,
    );
  }

  @Get('unread-count')
  unreadCount(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationAudienceDto,
  ) {
    return this.notifications.unreadCount(
      userId,
      query.audience,
      query.chatOnly,
      query.excludeChat,
    );
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationAudienceDto,
  ) {
    return this.notifications.markAllRead(userId, query.audience);
  }

  @Patch('read-chat')
  markChatRead(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationAudienceDto,
  ) {
    return this.notifications.markAllChatRead(userId, query.audience);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) notificationId: Types.ObjectId,
  ) {
    return this.notifications.markRead(userId, notificationId);
  }
}
