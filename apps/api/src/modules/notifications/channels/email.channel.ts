import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationChannel, NotificationEvent, OrderStatus } from '../../../common/enums';
import { createGuestOrderAccessToken } from '../../../common/utils/guest-order-access';
import { buildCustomerOrderEmailPath } from '../../../common/utils/guest-order-url';
import { isEphemeralGuestUser } from '../../../common/utils/guest-user';
import { Order, OrderDocument } from '../../../database/schemas/order.schema';
import { User, UserDocument } from '../../../database/schemas/user.schema';
import {
  MailerService,
  SendMailResult,
} from '../../../integrations/mail/mailer.service';
import { EmailSenderChannel } from '../../../integrations/mail/email-settings.service';
import {
  EmailOrderItem,
  toEmailOrderItems,
} from '../../../integrations/mail/email-templates';
import { BaseChannel } from './base.channel';
import {
  ChannelSendInput,
  ChannelSendResult,
} from './notification-channel.interface';
import { blocksCustomerSmtpEmail } from '../order-email.events';

/**
 * Email channel backed by SMTP (nodemailer via {@link MailerService}). Known
 * commerce events are rendered with rich, itemized templates by loading the
 * related order; every other event uses a branded generic template built from
 * the notification's title/body. Without SMTP credentials the mailer skips the
 * send (reported as a sandbox/skipped delivery).
 */
@Injectable()
export class EmailChannel extends BaseChannel {
  readonly channel = NotificationChannel.Email;

  private readonly accessSecret: string;

  constructor(
    config: ConfigService,
    private readonly mailer: MailerService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super(config);
    this.accessSecret =
      config.get<string>('jwt.accessSecret') ??
      config.get<string>('JWT_ACCESS_SECRET') ??
      'guest-order-access-fallback';
  }

  protected isConfigured(): boolean {
    // SMTP may be configured via admin settings or env; MailerService skips
    // delivery when transport is unavailable.
    return true;
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    try {
      const result = await this.route(input);
      if (result.skipped) return { success: true, skipped: true };
      if (result.success) return { success: true, providerRef: result.messageId };
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async route(input: ChannelSendInput): Promise<SendMailResult> {
    if (blocksCustomerSmtpEmail(input.event)) {
      return { success: true, skipped: true };
    }

    const to = input.recipient;
    const data = input.data ?? {};
    const orderId = this.str(data.orderId);
    const guestBuyer = await this.isGuestBuyer(input.userId);

    switch (input.event) {
      case NotificationEvent.OrderPlaced: {
        const order = orderId ? await this.loadOrder(orderId) : null;
        if (order?.status === OrderStatus.Pending) {
          return { success: true, skipped: true };
        }
        if (order) {
          return this.mailer.sendOrderConfirmation(to, {
            name: await this.resolveRecipientName(order, input.data, input.userId),
            orderNumber: order.orderNumber,
            items: this.orderItems(order),
            total: order.pricing.total,
            currency: order.pricing.currency,
            orderUrl: this.guestOrderUrl(order, guestBuyer),
          });
        }
        break;
      }
      case NotificationEvent.OrderPaid: {
        const order = orderId ? await this.loadOrder(orderId) : null;
        if (order?.status === OrderStatus.Pending) {
          return { success: true, skipped: true };
        }
        if (order) {
          return this.mailer.sendPaymentSuccess(to, {
            name: await this.resolveRecipientName(order, input.data, input.userId),
            orderNumber: order.orderNumber,
            amount: order.pricing.total,
            currency: order.pricing.currency,
            method: order.payment?.method,
            orderUrl: this.guestOrderUrl(order, guestBuyer),
            items: this.orderItems(order),
            customerEmail: order.contact?.email ?? to,
            customerMobile: order.contact?.mobile,
          });
        }
        break;
      }
      case NotificationEvent.OrderDelivered:
      case NotificationEvent.OrderRefunded: {
        const order = orderId ? await this.loadOrder(orderId) : null;
        if (order) {
          return this.mailer.sendOrderStatusUpdate(
            to,
            {
              name: await this.resolveRecipientName(order, input.data, input.userId),
              orderNumber: order.orderNumber,
              status:
                input.event === NotificationEvent.OrderRefunded
                  ? 'refunded'
                  : 'delivered',
              message: this.str(data.deliveryMessage),
              orderUrl: this.guestOrderUrl(order, guestBuyer),
            },
            this.parseEmailChannel(data.emailChannel),
          );
        }
        break;
      }
      case NotificationEvent.OrderNote: {
        const order = orderId ? await this.loadOrder(orderId) : null;
        const message = this.str(data.message);
        if (order && message) {
          return this.mailer.sendOrderCustomerNote(
            to,
            {
              name: await this.resolveRecipientName(order, input.data, input.userId),
              orderNumber: order.orderNumber,
              message,
              orderUrl: this.guestOrderUrl(order, guestBuyer),
            },
            this.parseEmailChannel(data.emailChannel),
          );
        }
        break;
      }
      case NotificationEvent.PaymentFailed: {
        const order = orderId ? await this.loadOrder(orderId) : null;
        const orderUrl = order
          ? this.guestOrderUrl(order, guestBuyer)
          : orderId
            ? `/orders/${orderId}`
            : undefined;
        return this.mailer.sendPaymentFailed(to, {
          name: order
            ? await this.resolveRecipientName(order, input.data, input.userId)
            : await this.resolveName(input.userId),
          orderNumber: order?.orderNumber ?? this.str(data.orderNumber),
          amount: order?.pricing?.total ?? this.num(data.amount),
          currency:
            order?.pricing?.currency ??
            (this.str(data.currency) || 'BDT'),
          reason: this.str(data.reason),
          retryUrl: orderUrl,
        });
      }
    }

    // Generic branded fallback for all other events.
    const ticketId = this.str(data.ticketId);
    const order = orderId ? await this.loadOrder(orderId) : null;
    const orderCtaUrl = order
      ? this.guestOrderUrl(order, guestBuyer)
      : orderId
        ? `/orders/${orderId}`
        : undefined;
    const cta = orderCtaUrl
      ? { ctaLabel: 'View order', ctaUrl: orderCtaUrl }
      : ticketId
        ? { ctaLabel: 'View ticket', ctaUrl: `/tickets/${ticketId}` }
        : {};
    return this.mailer.sendGeneric(to, {
      title: input.title,
      body: input.body,
      ...cta,
    });
  }

  private guestOrderUrl(order: OrderDocument, isGuest: boolean): string {
    const token = isGuest
      ? createGuestOrderAccessToken(
          String(order._id),
          order.orderNumber,
          this.accessSecret,
        )
      : undefined;
    return buildCustomerOrderEmailPath(order, isGuest, token);
  }

  private async isGuestBuyer(userId: string): Promise<boolean> {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('isGuest email')
        .lean()
        .exec();
      return user ? isEphemeralGuestUser(user) : false;
    } catch {
      return false;
    }
  }

  private async loadOrder(orderId: string): Promise<OrderDocument | null> {
    try {
      return await this.orderModel.findById(orderId).exec();
    } catch {
      return null;
    }
  }

  private orderItems(order: OrderDocument): EmailOrderItem[] {
    return toEmailOrderItems(order.items ?? []);
  }

  private async resolveRecipientName(
    order: OrderDocument | null,
    data?: Record<string, unknown>,
    userId?: string,
  ): Promise<string | undefined> {
    const fromOrder = order?.contact?.fullName?.trim();
    if (fromOrder) return fromOrder;

    const fromData =
      typeof data?.contactName === 'string' ? data.contactName.trim() : '';
    if (fromData) return fromData;

    if (userId) {
      return this.resolveName(userId);
    }
    return undefined;
  }

  private async resolveName(userId: string): Promise<string | undefined> {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('profile.displayName profile.firstName email')
        .lean()
        .exec();
      if (!user) return undefined;
      return (
        user.profile?.displayName ||
        user.profile?.firstName ||
        user.email?.split('@')[0]
      );
    } catch {
      return undefined;
    }
  }

  private str(value: unknown): string {
    return typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : '';
  }

  private num(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private parseEmailChannel(
    value: unknown,
  ): EmailSenderChannel | undefined {
    const channel = this.str(value);
    if (
      channel === 'default' ||
      channel === 'orders' ||
      channel === 'support' ||
      channel === 'system' ||
      channel === 'admin'
    ) {
      return channel;
    }
    return undefined;
  }
}
