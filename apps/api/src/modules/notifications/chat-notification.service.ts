import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationAudience } from '../../common/enums';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import { CHAT_STAFF_ROLES, isChatStaff } from '../../common/utils/role.utils';
import type { ChatRoomDocument } from '../../database/schemas/chat-room.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { MailerService } from '../../integrations/mail/mailer.service';
import { CacheService } from '../../shared/cache/cache.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  runIsolatedSideEffect,
  runIsolatedSideEffectVoid,
} from '../../shared/utils/isolated-side-effect';
import { NotificationsService } from './notifications.service';
import { TelegramChatNotifier } from './telegram-chat-notifier.service';

const isStaff = (user: AuthenticatedUser): boolean => isChatStaff(user.roles);

const chatMessagePreview = (body?: string, imageUrl?: string): string => {
  const text = body?.trim() ?? '';
  if (text) return text.slice(0, 200);
  if (imageUrl?.trim()) return '[Image]';
  return '';
};

/** At most one "support replied" email per room within this window. */
const CHAT_REPLY_EMAIL_THROTTLE_SECONDS = 10 * 60;

const chatReplyEmailThrottleKey = (roomId: string): string =>
  `chat:reply-email:${roomId}`;

/**
 * Live chat notification bridge: in-app bell alerts and admin Telegram alerts
 * are dispatched independently so one channel failing does not block the other.
 */
@Injectable()
export class ChatNotificationService {
  private readonly logger = new Logger(ChatNotificationService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
    private readonly telegramChat: TelegramChatNotifier,
    private readonly mailer: MailerService,
    private readonly cache: CacheService,
  ) {}

  async notifyChatMessage(
    room: ChatRoomDocument,
    sender: AuthenticatedUser,
    body?: string,
    imageUrl?: string,
  ): Promise<void> {
    const preview = chatMessagePreview(body, imageUrl).slice(0, 160);
    const roomId = String(room._id);
    const subject = room.subject?.trim() || 'Live chat';

    if (isStaff(sender)) {
      const customerId = String(room.createdBy);
      if (!customerId || customerId === sender.id) {
        return;
      }
      await runIsolatedSideEffect(
        `Live chat in-app alert (customer) room ${roomId}`,
        this.logger,
        async () => {
          await this.notifications.upsertChatNotification({
            userId: customerId,
            audience: NotificationAudience.Customer,
            roomId,
            title: 'Support replied',
            body: preview || 'You have a new reply in live chat.',
          });
        },
      );
      runIsolatedSideEffectVoid(
        `Live chat reply email (customer) room ${roomId}`,
        this.logger,
        () => this.emailCustomerReply(customerId, roomId, preview),
      );
      return;
    }

    await runIsolatedSideEffect(
      `Live chat in-app alerts (staff) room ${roomId}`,
      this.logger,
      () => this.notifyStaffInApp(roomId, subject, preview, sender.id),
    );

    runIsolatedSideEffectVoid(
      `Live chat Telegram alert room ${roomId}`,
      this.logger,
      () => this.telegramChat.notifyCustomerMessage(room, sender, body, imageUrl),
    );
  }

  /**
   * Email the customer when support replies in live chat. Best-effort:
   * skips guests, throttled to one email per room per 10 minutes so a burst
   * of admin messages does not flood the customer's inbox. Template-gated
   * via the "Live Chat Reply" entry in the email template library.
   */
  private async emailCustomerReply(
    customerId: string,
    roomId: string,
    preview: string,
  ): Promise<void> {
    const customer = await this.userModel
      .findById(customerId)
      .select('email isGuest profile')
      .lean()
      .exec();
    if (!customer?.email || isEphemeralGuestUser(customer)) {
      return;
    }

    const throttleKey = chatReplyEmailThrottleKey(roomId);
    if (await this.cache.get(throttleKey)) {
      return;
    }
    await this.cache.set(throttleKey, '1', CHAT_REPLY_EMAIL_THROTTLE_SECONDS);

    const name =
      customer.profile?.firstName?.trim() ||
      customer.profile?.displayName?.trim() ||
      undefined;
    const result = await this.mailer.sendChatReply(customer.email, {
      name,
      message: preview || 'You have a new reply in live chat.',
      chatUrl: '/chat',
    });
    if (!result.success) {
      // Allow a retry on the next admin reply instead of waiting out the window.
      await this.cache.del(throttleKey);
    }
  }

  private async notifyStaffInApp(
    roomId: string,
    subject: string,
    preview: string,
    senderId: string,
  ): Promise<void> {
    const staffUsers = await this.userModel
      .find({ roles: { $in: [...CHAT_STAFF_ROLES] } })
      .select('_id')
      .lean()
      .exec();

    await Promise.all(
      staffUsers.map((staff) =>
        this.notifications.upsertChatNotification({
          userId: String(staff._id),
          audience: NotificationAudience.Staff,
          roomId,
          title: `New chat: ${subject}`,
          body: preview || 'A customer sent a message in live chat.',
          data: { senderId },
        }),
      ),
    );
  }
}
