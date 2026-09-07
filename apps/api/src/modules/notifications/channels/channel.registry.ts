import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../common/enums';
import { EmailChannel } from './email.channel';
import { NotificationChannelAdapter } from './notification-channel.interface';
import { PushChannel } from './push.channel';
import { TelegramChannel } from './telegram.channel';

/** Resolves a channel adapter by its enum. */
@Injectable()
export class ChannelRegistry {
  private readonly channels: Map<NotificationChannel, NotificationChannelAdapter>;

  constructor(
    email: EmailChannel,
    push: PushChannel,
    telegram: TelegramChannel,
  ) {
    this.channels = new Map(
      [email, push, telegram].map((c) => [c.channel, c] as const),
    );
  }

  get(channel: NotificationChannel): NotificationChannelAdapter | undefined {
    return this.channels.get(channel);
  }
}
