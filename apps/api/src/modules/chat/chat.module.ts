import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  ChatMessage,
  ChatMessageSchema,
} from '../../database/schemas/chat-message.schema';
import {
  ChatSettings,
  ChatSettingsSchema,
} from '../../database/schemas/chat-settings.schema';
import {
  ChatRoom,
  ChatRoomSchema,
} from '../../database/schemas/chat-room.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { AuthModule } from '../auth/auth.module';
import { LicenseModule } from '../license/license.module';
import { CHAT_QUEUE } from '../../queues/queue.constants';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatSettingsService } from './chat-settings.service';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';
import { ChatImageCleanupService } from './chat-image-cleanup.service';
import { ChatImageCleanupProcessor } from './chat-image-cleanup.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatSettings.name, schema: ChatSettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
    BullModule.registerQueue({ name: CHAT_QUEUE }),
    JwtModule.register({}),
    NotificationsModule,
    forwardRef(() => AuthModule),
    LicenseModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ChatSettingsService,
    PresenceService,
    UploadsService,
    ChatImageCleanupService,
    ChatImageCleanupProcessor,
  ],
  exports: [ChatService, ChatSettingsService],
})
export class ChatModule {}
