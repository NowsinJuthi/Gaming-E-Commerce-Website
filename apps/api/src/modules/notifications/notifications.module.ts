import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificationDelivery,
  NotificationDeliverySchema,
} from '../../database/schemas/notification-delivery.schema';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from '../../database/schemas/notification-preference.schema';
import {
  Notification,
  NotificationSchema,
} from '../../database/schemas/notification.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { Product, ProductSchema } from '../../database/schemas/product.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import {
  TelegramSettings,
  TelegramSettingsSchema,
} from '../../database/schemas/telegram-settings.schema';
import { NOTIFICATIONS_QUEUE } from '../../queues/queue.constants';
import { ChannelRegistry } from './channels/channel.registry';
import { EmailChannel } from './channels/email.channel';
import { PushChannel } from './channels/push.channel';
import { TelegramChannel } from './channels/telegram.channel';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationAdminService } from './notification-admin.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { GuestCheckoutMailService } from './guest-checkout-mail.service';
import { NotificationPreferenceController } from './notification-preference.controller';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ChatNotificationService } from './chat-notification.service';
import { TelegramChatNotifier } from './telegram-chat-notifier.service';
import { TelegramOrderNotifier } from './telegram-order-notifier.service';
import { TelegramSettingsService } from './telegram-settings.service';
import { EmailDeliveryLogService } from './email-delivery-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
      { name: NotificationDelivery.name, schema: NotificationDeliverySchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: TelegramSettings.name, schema: TelegramSettingsSchema },
    ]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [
    NotificationsController,
    NotificationPreferenceController,
    NotificationAdminController,
  ],
  providers: [
    NotificationsService,
    NotificationPreferenceService,
    NotificationDispatcher,
    GuestCheckoutMailService,
    NotificationAdminService,
    NotificationProcessor,
    EmailDeliveryLogService,
    TelegramSettingsService,
    ChatNotificationService,
    TelegramOrderNotifier,
    TelegramChatNotifier,
    EmailChannel,
    PushChannel,
    TelegramChannel,
    ChannelRegistry,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcher,
    NotificationPreferenceService,
    ChatNotificationService,
    TelegramOrderNotifier,
    TelegramChatNotifier,
    EmailDeliveryLogService,
  ],
})
export class NotificationsModule {}
