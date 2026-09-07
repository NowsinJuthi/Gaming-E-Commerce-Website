import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';
import { DeleteDeliveriesDto } from './dto/delete-deliveries.dto';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto';
import { UpdateTelegramSettingsDto } from './dto/update-telegram-settings.dto';
import { NotificationAdminService } from './notification-admin.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { TelegramSettingsService } from './telegram-settings.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('notifications/admin')
export class NotificationAdminController {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly admin: NotificationAdminService,
    private readonly telegramSettings: TelegramSettingsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('deliveries')
  deliveries(@Query() query: QueryDeliveriesDto) {
    return this.admin.listDeliveries(query);
  }

  @Get('deliveries/:id/preview')
  previewDelivery(@Param('id') id: string) {
    return this.admin.previewEmailDelivery(id);
  }

  @Delete('deliveries/:id')
  deleteDelivery(@Param('id') id: string) {
    return this.admin.deleteEmailDelivery(id);
  }

  @Post('deliveries/bulk-delete')
  bulkDeleteDeliveries(@Body() dto: DeleteDeliveriesDto) {
    return this.admin.deleteEmailDeliveries(dto.ids);
  }

  /** Triggers an event-based notification (testing / manual broadcasts). */
  @Post('dispatch')
  async dispatch(@Body() dto: DispatchNotificationDto) {
    await this.dispatcher.dispatch(
      dto.event,
      dto.userId,
      dto.context ?? {},
      dto.audience,
    );
    return { dispatched: true };
  }

  @Get('telegram/settings')
  getTelegramSettings() {
    return this.telegramSettings.getSettings();
  }

  @Patch('telegram/settings')
  updateTelegramSettings(@Body() dto: UpdateTelegramSettingsDto) {
    return this.telegramSettings.updateSettings(dto);
  }

  @Post('telegram/test')
  async testTelegram() {
    return this.telegramSettings.sendTestMessage();
  }

  @Post('telegram/discover-chats')
  discoverTelegramChats(@Body() body: { botToken?: string }) {
    return this.telegramSettings.discoverChats(body?.botToken);
  }
}
