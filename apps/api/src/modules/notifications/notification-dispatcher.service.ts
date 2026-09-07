import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { NotificationAudience, NotificationChannel, NotificationEvent, OrderStatus } from '../../common/enums';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOB_OPTIONS,
  NotificationJob,
  NotificationJobData,
} from '../../queues/queue.constants';
import {
  NOTIFICATION_TEMPLATES,
  NotificationContext,
  NotificationTemplate,
  RenderedNotification,
} from './notification-templates';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationsService } from './notifications.service';
import { NotificationPreferenceDocument } from '../../database/schemas/notification-preference.schema';
import { GuestCheckoutMailService } from './guest-checkout-mail.service';
import {
  GUEST_CHECKOUT_EMAIL_EVENTS,
  blocksCustomerSmtpEmail,
} from './order-email.events';

/**
 * Event-based notification entry point. Renders an event template, applies the
 * user's channel preferences, persists the in-app copy synchronously, and
 * enqueues external channel deliveries (email/push/telegram). Best-effort:
 * dispatch never throws into the caller's flow.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationJobData>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly prefs: NotificationPreferenceService,
    private readonly notifications: NotificationsService,
    private readonly guestMail: GuestCheckoutMailService,
  ) {}

  async dispatch(
    event: NotificationEvent,
    userId: string | Types.ObjectId,
    context: NotificationContext = {},
    audience: NotificationAudience = NotificationAudience.Customer,
  ): Promise<void> {
    try {
      const template = NOTIFICATION_TEMPLATES[event];
      if (!template) {
        this.logger.warn(`No template registered for event ${event}`);
        return;
      }

      const uid = String(userId);
      const user = await this.userModel
        .findById(uid)
        .select('isGuest email')
        .lean()
        .exec();
      if (!user) {
        return;
      }

      if (isEphemeralGuestUser(user)) {
        await this.dispatchGuestCheckout(event, uid, context, template);
        return;
      }

      const pref = await this.prefs.getOrCreate(uid);
      if (pref.mutedEvents.includes(event)) {
        return;
      }

      const rendered = template.render(context);
      const channels = template.defaultChannels.filter((channel) =>
        this.prefs.isChannelEnabled(pref, channel),
      );

      const externalChannels = channels.filter(
        (channel) =>
          channel !== NotificationChannel.Email ||
          !blocksCustomerSmtpEmail(event),
      );

      if (await this.shouldSkipOrderNotification(event, context)) {
        if (channels.includes(NotificationChannel.InApp)) {
          await this.notifications.create({
            userId: uid,
            type: template.type,
            audience,
            title: rendered.title,
            body: rendered.body,
            data: rendered.data,
          });
        }
        return;
      }

      if (channels.includes(NotificationChannel.InApp)) {
        await this.notifications.create({
          userId: uid,
          type: template.type,
          audience,
          title: rendered.title,
          body: rendered.body,
          data: rendered.data,
        });
      }

      await this.enqueueExternal(event, uid, pref, externalChannels, rendered);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch ${event} to ${String(userId)}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Guest checkout has no durable account inbox — email the buyer using the
   * contact details captured on the order instead of the ephemeral user record.
   */
  private async dispatchGuestCheckout(
    event: NotificationEvent,
    userId: string,
    context: NotificationContext,
    template: NotificationTemplate,
  ): Promise<void> {
    const hasEmailChannel = template.defaultChannels.includes(
      NotificationChannel.Email,
    );
    const allowGuestEmail =
      GUEST_CHECKOUT_EMAIL_EVENTS.has(event) && hasEmailChannel;

    if (!allowGuestEmail) {
      return;
    }

    const orderId = typeof context.orderId === 'string' ? context.orderId : '';
    if (!orderId) {
      this.logger.warn(`Guest notification ${event} skipped — missing orderId`);
      return;
    }

    const outcome = await this.guestMail.sendForOrder(
      event,
      userId,
      orderId,
      context,
      (ctx) => template.render(ctx),
    );
    if (outcome === 'failed') {
      await this.enqueueGuestEmailJob(event, userId, orderId, context, template);
    }
  }

  private async enqueueGuestEmailJob(
    event: NotificationEvent,
    userId: string,
    orderId: string,
    context: NotificationContext,
    template: NotificationTemplate,
  ): Promise<void> {
    const contact = await this.guestMail.resolveContact(orderId);
    if (!contact) {
      return;
    }

    const rendered = template.render(context);
    rendered.data = {
      ...rendered.data,
      orderId,
      ...(contact.fullName ? { contactName: contact.fullName } : {}),
    };

    try {
      await this.queue.add(
        NotificationJob.Send,
        this.job(
          event,
          userId,
          NotificationChannel.Email,
          contact.email,
          rendered,
        ),
        NOTIFICATION_JOB_OPTIONS,
      );
    } catch (queueError) {
      this.logger.warn(
        `Guest email queue backup failed for ${event}: ${
          queueError instanceof Error ? queueError.message : String(queueError)
        }`,
      );
    }
  }

  private async shouldSkipOrderNotification(
    event: NotificationEvent,
    context: NotificationContext,
  ): Promise<boolean> {
    const orderId = typeof context.orderId === 'string' ? context.orderId.trim() : '';
    if (!orderId) {
      return false;
    }

    const orderEvents = new Set<NotificationEvent>([
      NotificationEvent.OrderPlaced,
      NotificationEvent.OrderPaid,
      NotificationEvent.OrderDelivered,
      NotificationEvent.OrderNote,
      NotificationEvent.OrderRefunded,
    ]);
    if (!orderEvents.has(event)) {
      return false;
    }

    const order = await this.orderModel
      .findById(orderId)
      .select('status')
      .lean()
      .exec();
    if (!order) {
      return false;
    }

    if (order.status === OrderStatus.Pending) {
      return true;
    }

    return false;
  }

  private async enqueueExternal(
    event: NotificationEvent,
    userId: string,
    pref: NotificationPreferenceDocument,
    channels: NotificationChannel[],
    rendered: RenderedNotification,
  ): Promise<void> {
    const jobs: NotificationJobData[] = [];

    if (channels.includes(NotificationChannel.Email)) {
      const email = await this.resolveEmail(userId);
      if (email) {
        jobs.push(this.job(event, userId, NotificationChannel.Email, email, rendered));
      }
    }

    if (
      channels.includes(NotificationChannel.Telegram) &&
      pref.telegramChatId
    ) {
      jobs.push(
        this.job(
          event,
          userId,
          NotificationChannel.Telegram,
          pref.telegramChatId,
          rendered,
        ),
      );
    }

    if (channels.includes(NotificationChannel.Push)) {
      for (const token of pref.pushTokens) {
        jobs.push(
          this.job(event, userId, NotificationChannel.Push, token, rendered),
        );
      }
    }

    await Promise.all(
      jobs.map(async (data) => {
        try {
          await this.queue.add(
            NotificationJob.Send,
            data,
            NOTIFICATION_JOB_OPTIONS,
          );
        } catch (queueError) {
          this.logger.warn(
            `Notification queue unavailable for ${event}/${data.channel}: ${
              queueError instanceof Error ? queueError.message : String(queueError)
            }`,
          );
        }
      }),
    );
  }

  private job(
    event: NotificationEvent,
    userId: string,
    channel: NotificationChannel,
    recipient: string,
    rendered: RenderedNotification,
  ): NotificationJobData {
    return {
      userId,
      event,
      channel,
      recipient,
      title: rendered.title,
      body: rendered.body,
      data: rendered.data,
    };
  }

  private async resolveEmail(userId: string): Promise<string | undefined> {
    const user = await this.userModel
      .findById(userId)
      .select('email')
      .lean()
      .exec();
    return user?.email;
  }
}
