import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushTokenDto } from './dto/push-token.dto';
import { SetTelegramDto } from './dto/set-telegram.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationPreferenceService } from './notification-preference.service';

@Controller('notifications/preferences')
export class NotificationPreferenceController {
  constructor(private readonly prefs: NotificationPreferenceService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.prefs.getOrCreate(userId);
  }

  @Put()
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.prefs.update(userId, dto);
  }

  @Put('telegram')
  setTelegram(
    @CurrentUser('id') userId: string,
    @Body() dto: SetTelegramDto,
  ) {
    return this.prefs.setTelegramChatId(userId, dto.chatId);
  }

  @Put('push-tokens')
  addPushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: PushTokenDto,
  ) {
    return this.prefs.addPushToken(userId, dto.token);
  }

  @Delete('push-tokens')
  removePushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: PushTokenDto,
  ) {
    return this.prefs.removePushToken(userId, dto.token);
  }
}
