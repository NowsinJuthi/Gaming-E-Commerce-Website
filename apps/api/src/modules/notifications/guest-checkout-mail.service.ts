import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationEvent } from '../../common/enums';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { EmailChannel } from './channels/email.channel';
import { EmailDeliveryLogService } from './email-delivery-log.service';
import { NotificationContext, RenderedNotification } from './notification-templates';

export type GuestCheckoutMailOutcome = 'sent' | 'skipped' | 'failed' | 'no_contact';

/**
 * Sends guest-checkout customer emails synchronously via SMTP (same reliability
 * model as admin new-order alerts). Guest buyers have no in-app inbox and must
 * not depend on the notification queue worker.
 */
@Injectable()
export class GuestCheckoutMailService {
  private readonly logger = new Logger(GuestCheckoutMailService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly emailChannel: EmailChannel,
    private readonly emailDeliveryLog: EmailDeliveryLogService,
  ) {}

  async resolveContact(
    orderId: string,
  ): Promise<{ email: string; fullName?: string } | null> {
    const order = await this.orderModel
      .findById(orderId)
      .select('contact.email contact.fullName')
      .lean()
      .exec();
    const email = order?.contact?.email?.trim().toLowerCase();
    if (!email) {
      return null;
    }
    const fullName = order?.contact?.fullName?.trim();
    return { email, ...(fullName ? { fullName } : {}) };
  }

  async send(
    event: NotificationEvent,
    userId: string,
    orderId: string,
    rendered: RenderedNotification,
    contact: { email: string; fullName?: string },
  ): Promise<GuestCheckoutMailOutcome> {
    const payload: RenderedNotification = {
      ...rendered,
      data: {
        ...rendered.data,
        orderId,
        ...(contact.fullName ? { contactName: contact.fullName } : {}),
      },
    };

    const result = await this.emailChannel.send({
      userId,
      recipient: contact.email,
      title: payload.title,
      body: payload.body,
      event,
      data: payload.data,
    });

    if (result.skipped) {
      this.logger.warn(
        `Guest checkout email skipped (${event}) to ${contact.email} — SMTP off, mock mode, or template disabled`,
      );
      await this.recordGuestCheckoutEmailLog(
        event,
        userId,
        orderId,
        contact.email,
        payload.title,
        true,
        true,
      );
      return 'skipped';
    }

    if (!result.success) {
      this.logger.error(
        `Guest checkout email failed (${event}) to ${contact.email}: ${result.error ?? 'unknown error'}`,
      );
      await this.recordGuestCheckoutEmailLog(
        event,
        userId,
        orderId,
        contact.email,
        payload.title,
        false,
        false,
        result.error,
      );
      return 'failed';
    }

    this.logger.log(`Guest checkout email sent (${event}) to ${contact.email}`);
    await this.recordGuestCheckoutEmailLog(
      event,
      userId,
      orderId,
      contact.email,
      payload.title,
      true,
      Boolean(result.skipped),
      undefined,
      result.providerRef,
    );
    return 'sent';
  }

  private async recordGuestCheckoutEmailLog(
    event: NotificationEvent,
    userId: string,
    orderId: string,
    recipient: string,
    title: string,
    success: boolean,
    skipped: boolean,
    error?: string,
    messageId?: string,
  ): Promise<void> {
    const order = await this.orderModel
      .findById(orderId)
      .select('orderNumber')
      .lean()
      .exec();
    await this.emailDeliveryLog.recordDirectSend({
      userId,
      event,
      recipient,
      title,
      orderNumber: order?.orderNumber,
      success,
      skipped,
      error,
      messageId,
    });
  }

  /** Load order contact and send synchronously via SMTP. */
  async sendForOrder(
    event: NotificationEvent,
    userId: string,
    orderId: string,
    context: NotificationContext,
    render: (ctx: NotificationContext) => RenderedNotification,
  ): Promise<GuestCheckoutMailOutcome> {
    const contact = await this.resolveContact(orderId);
    if (!contact) {
      this.logger.warn(
        `Guest checkout email (${event}) skipped — no contact email on order ${orderId}`,
      );
      return 'no_contact';
    }

    return this.send(event, userId, orderId, render(context), contact);
  }
}
