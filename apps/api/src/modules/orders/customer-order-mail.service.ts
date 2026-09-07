import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentStatus } from '../../common/enums';
import { OrderStatus } from '../../common/enums/order.enum';
import {
  PaymentIntent,
  PaymentIntentDocument,
} from '../../database/schemas/payment-intent.schema';
import {
  SmsLog,
  SmsLogDocument,
} from '../../database/schemas/sms-log.schema';
import {
  createGuestOrderAccessToken,
  maskCustomerEmail,
  verifyGuestOrderAccessToken,
} from '../../common/utils/guest-order-access';
import { buildCustomerOrderEmailPath } from '../../common/utils/guest-order-url';
import { isEphemeralGuestUser, isGuestMailbox } from '../../common/utils/guest-user';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { MailerService } from '../../integrations/mail/mailer.service';
import {
  EmailSenderChannel,
  EmailSettingsService,
} from '../../integrations/mail/email-settings.service';
import { EmailTemplateService } from '../../integrations/mail/email-template.service';
import {
  ORDER_CUSTOMER_EMAIL_TEMPLATE_ID,
  ORDER_CUSTOMER_NOTE_TEMPLATE_ID,
  ORDER_FAILED_TEMPLATE_ID,
  ORDER_INVOICE_TEMPLATE_ID,
  ORDER_PENDING_TEMPLATE_ID,
} from '../../integrations/mail/order-email-template.ids';
import { EmailDeliveryLogService } from '../notifications/email-delivery-log.service';
import {
  allowsCustomerOrderEmail,
  type CustomerOrderEmailStatus,
} from '../notifications/order-notification-policy';
import { resolveOrderPaymentTrxId } from './order-payment-trx.util';
import { buildEmailOrderItemsFromOrder } from './order-email-items.util';

type BuyerLike = Pick<UserDocument, 'isGuest' | 'email' | 'profile'> | null | undefined;

const STATUS_FLAG_FIELD: Record<CustomerOrderEmailStatus, string> = {
  paid: 'customerEmails.paidSentAt',
  processing: 'customerEmails.processingSentAt',
  delivered: 'customerEmails.deliveredSentAt',
  cancelled: 'customerEmails.cancelledSentAt',
  refunded: 'customerEmails.refundedSentAt',
};

const STATUS_MAILER_KEY: Record<CustomerOrderEmailStatus, string> = {
  paid: 'paid',
  processing: 'processing',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'refunded',
};

const STATUS_EVENT_ID: Record<CustomerOrderEmailStatus, string> = {
  paid: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid,
  processing: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing,
  delivered: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered,
  cancelled: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.cancelled,
  refunded: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.refunded,
};

/**
 * Customer order emails via SMTP on status transitions (Paid, Processing, etc.).
 * Independent from admin Telegram — changes here must not touch TelegramOrderNotifier.
 */
@Injectable()
export class CustomerOrderMailService {
  private readonly logger = new Logger(CustomerOrderMailService.name);

  private readonly accessSecret: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(PaymentIntent.name)
    private readonly paymentIntentModel: Model<PaymentIntentDocument>,
    @InjectModel(SmsLog.name) private readonly smsLogModel: Model<SmsLogDocument>,
    private readonly mailer: MailerService,
    private readonly emailSettings: EmailSettingsService,
    private readonly emailTemplates: EmailTemplateService,
    private readonly emailDeliveryLog: EmailDeliveryLogService,
    config: ConfigService,
  ) {
    this.accessSecret =
      config.get<string>('jwt.accessSecret') ??
      config.get<string>('JWT_ACCESS_SECRET') ??
      'guest-order-access-fallback';
  }

  guestReceiptToken(order: OrderDocument, isGuest: boolean): string | undefined {
    if (!isGuest) return undefined;
    return createGuestOrderAccessToken(
      String(order._id),
      order.orderNumber,
      this.accessSecret,
    );
  }

  async getGuestReceipt(token: string): Promise<{
    orderNumber: string;
    status: string;
    emailMasked: string;
    paid: boolean;
  } | null> {
    const parsed = verifyGuestOrderAccessToken(token.trim(), this.accessSecret);
    if (!parsed) {
      return null;
    }

    const order = await this.orderModel
      .findOne({ _id: parsed.orderId, orderNumber: parsed.orderNumber })
      .select('orderNumber status payment.status contact.email')
      .lean()
      .exec();
    const email = order?.contact?.email?.trim();
    if (!order?.orderNumber || !email) {
      return null;
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      emailMasked: maskCustomerEmail(email),
      paid: order.payment?.status === PaymentStatus.Paid,
    };
  }

  /** Customer email when a pending (unpaid) order is created at checkout. */
  async sendOrderPending(
    order: OrderDocument,
    buyer?: BuyerLike,
  ): Promise<void> {
    if (!(await this.isOrderCustomerEmailEnabled(order.orderNumber, 'pending order'))) {
      return;
    }
    if (
      !(await this.isCustomerTemplateEnabled(
        order.orderNumber,
        ORDER_PENDING_TEMPLATE_ID,
        'pending order',
      ))
    ) {
      return;
    }

    const resolvedBuyer = buyer ?? (await this.loadBuyer(order));
    const to = this.resolveCustomerEmail(order, resolvedBuyer);
    if (!to) {
      this.logger.warn(
        `Order ${order.orderNumber}: no customer email for pending order notice`,
      );
      return;
    }

    const isGuest = this.isGuestBuyer(resolvedBuyer);
    const items = await buildEmailOrderItemsFromOrder(
      order.items ?? [],
      this.productModel,
      await this.emailSettings.getEffective(),
    );
    const result = await this.mailer.sendOrderPending(to, {
      name: this.resolveCustomerName(order, resolvedBuyer),
      orderNumber: order.orderNumber,
      items,
      total: order.pricing.total,
      currency: order.pricing.currency,
      orderUrl: buildCustomerOrderEmailPath(
        order,
        isGuest,
        this.guestReceiptToken(order, isGuest),
      ),
    });

    this.logSendResult('pending order', order.orderNumber, to, result);
    await this.emailDeliveryLog.recordDirectSend({
      userId: String(order.userId),
      event: ORDER_PENDING_TEMPLATE_ID,
      recipient: to,
      title: `Order ${order.orderNumber} — payment pending`,
      orderNumber: order.orderNumber,
      success: result.success,
      skipped: result.skipped,
      error: result.error,
      messageId: result.messageId,
    });
  }

  /**
   * Order confirmation after payment is submitted — not a payment-due or receipt email.
   * Fires from wallet pay, MFS TrxID/SMS match, or gateway settlement.
   */
  async sendOrderConfirmedAfterPayment(
    order: OrderDocument,
    buyer?: BuyerLike,
  ): Promise<void> {
    const fresh = await this.orderModel
      .findById(order._id)
      .select('status payment.status orderNumber')
      .lean()
      .exec();
    const snapshot = fresh ?? order;
    if (snapshot.status === OrderStatus.Pending) {
      this.logger.warn(
        `Order ${snapshot.orderNumber}: confirmation email skipped — order still pending`,
      );
      return;
    }

    const label = 'order confirmation';
    if (!(await this.isOrderCustomerEmailEnabled(order.orderNumber, label))) {
      return;
    }
    const paidTemplateId = await this.resolvePaidReceiptTemplateId();
    if (
      !(await this.isCustomerTemplateEnabled(
        order.orderNumber,
        paidTemplateId,
        label,
      ))
    ) {
      return;
    }

    const claimed = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          'customerEmails.paidSentAt': { $exists: false },
        },
        {
          $set: {
            'customerEmails.paidSentAt': new Date(),
            'customerEmails.confirmationSentAt': new Date(),
          },
        },
        { new: false },
      )
      .exec();
    if (!claimed) {
      return;
    }

    const resolvedBuyer = buyer ?? (await this.loadBuyer(order));
    const to = this.resolveCustomerEmail(order, resolvedBuyer);
    if (!to) {
      await this.orderModel
        .updateOne(
          { _id: order._id },
          {
            $unset: {
              'customerEmails.confirmationSentAt': '',
              'customerEmails.paidSentAt': '',
            },
          },
        )
        .exec();
      this.logger.warn(
        `Order ${order.orderNumber}: no customer email for ${label}`,
      );
      return;
    }

    const isGuest = this.isGuestBuyer(resolvedBuyer);
    const items = await buildEmailOrderItemsFromOrder(
      order.items ?? [],
      this.productModel,
      await this.emailSettings.getEffective(),
    );
    const paymentTrxId = await resolveOrderPaymentTrxId(
      this.paymentIntentModel,
      this.smsLogModel,
      String(order._id),
    );
    const result = await this.mailer.sendOrderPaid(
      to,
      {
        name: this.resolveCustomerName(order, resolvedBuyer),
        orderNumber: order.orderNumber,
        items,
        total: order.pricing.total,
        currency: order.pricing.currency,
        customerEmail: to,
        paymentMethod: order.payment?.method,
        paymentTrxId,
        orderUrl: buildCustomerOrderEmailPath(
          order,
          isGuest,
          this.guestReceiptToken(order, isGuest),
        ),
      },
      undefined,
      paidTemplateId!,
    );

    this.logSendResult(label, order.orderNumber, to, result);
    await this.emailDeliveryLog.recordDirectSend({
      userId: String(order.userId),
      event: paidTemplateId!,
      recipient: to,
      title: `Order ${order.orderNumber} — payment confirmed`,
      orderNumber: order.orderNumber,
      success: result.success,
      skipped: result.skipped,
      error: result.error,
      messageId: result.messageId,
    });

    if (result.skipped || !result.success) {
      await this.orderModel
        .updateOne(
          { _id: order._id },
          {
            $unset: {
              'customerEmails.confirmationSentAt': '',
              'customerEmails.paidSentAt': '',
            },
          },
        )
        .exec();
    }
  }

  /**
   * Idempotent customer email for Paid / Processing / Delivered / Cancelled / Refunded.
   * Not used for pending checkout or standalone payment-success hooks.
   */
  async trySendStatusEmail(
    order: OrderDocument,
    status: CustomerOrderEmailStatus,
    message?: string,
    emailChannel?: EmailSenderChannel,
    buyer?: BuyerLike,
  ): Promise<void> {
    const fresh = await this.orderModel
      .findById(order._id)
      .select('status payment.status orderNumber')
      .lean()
      .exec();
    const snapshot = fresh ?? order;
    if (!allowsCustomerOrderEmail(snapshot, status)) {
      this.logger.warn(
        `Order ${snapshot.orderNumber}: ${status} email skipped — pending checkout or unpaid order`,
      );
      return;
    }

    if (status === 'processing') {
      const flags = await this.orderModel
        .findById(order._id)
        .select('customerEmails.confirmationSentAt')
        .lean()
        .exec();
      if (flags?.customerEmails?.confirmationSentAt) {
        return;
      }
    }

    const label = status.replace('_', ' ');
    if (!(await this.isOrderCustomerEmailEnabled(order.orderNumber, label))) {
      return;
    }

    const templateId =
      status === 'paid'
        ? await this.resolvePaidReceiptTemplateId()
        : ORDER_CUSTOMER_EMAIL_TEMPLATE_ID[status];
    if (!(await this.isCustomerTemplateEnabled(order.orderNumber, templateId, label))) {
      return;
    }

    const flagField = STATUS_FLAG_FIELD[status];
    const claimed = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, [flagField]: { $exists: false } },
        { $set: { [flagField]: new Date() } },
        { new: false },
      )
      .exec();
    if (!claimed) {
      return;
    }

    const resolvedBuyer = buyer ?? (await this.loadBuyer(order));
    const to = this.resolveCustomerEmail(order, resolvedBuyer);
    if (!to) {
      await this.clearStatusFlag(order._id, status);
      this.logger.warn(
        `Order ${order.orderNumber}: no customer email for ${label} notice`,
      );
      return;
    }

    const isGuest = this.isGuestBuyer(resolvedBuyer);
    const trimmedMessage = message?.trim();
    const customerName = this.resolveCustomerName(order, resolvedBuyer);
    const orderUrl = buildCustomerOrderEmailPath(
      order,
      isGuest,
      this.guestReceiptToken(order, isGuest),
    );

    let paidItems = order.items;
    let paymentTrxId: string | undefined;
    if (status === 'paid') {
      const freshItems = await this.orderModel
        .findById(order._id)
        .select('items')
        .lean()
        .exec();
      if (freshItems?.items?.length) {
        paidItems = freshItems.items as OrderDocument['items'];
      }
      paymentTrxId = await resolveOrderPaymentTrxId(
        this.paymentIntentModel,
        this.smsLogModel,
        String(order._id),
      );
    }

    const mailPayload = {
      name: customerName,
      orderNumber: order.orderNumber,
      status: STATUS_MAILER_KEY[status],
      message: trimmedMessage || order.deliveryMessage,
      orderUrl,
      ...(status === 'paid'
        ? {
            items: await buildEmailOrderItemsFromOrder(
              paidItems ?? [],
              this.productModel,
              await this.emailSettings.getEffective(),
            ),
            total: order.pricing.total,
            currency: order.pricing.currency,
            customerEmail: to,
            paymentMethod: order.payment?.method,
            paymentTrxId,
          }
        : {}),
    };
    const result =
      status === 'paid' && templateId
        ? await this.mailer.sendOrderPaid(
            to,
            {
              name: customerName,
              orderNumber: order.orderNumber,
              items: mailPayload.items,
              total: order.pricing.total,
              currency: order.pricing.currency,
              customerEmail: to,
              paymentMethod: order.payment?.method,
              paymentTrxId,
              orderUrl,
            },
            emailChannel,
            templateId,
          )
        : await this.mailer.sendOrderStatusUpdate(
            to,
            mailPayload,
            emailChannel,
          );

    this.logSendResult(`order ${status}`, order.orderNumber, to, result);
    await this.emailDeliveryLog.recordDirectSend({
      userId: String(order.userId),
      event: templateId ?? STATUS_EVENT_ID[status],
      recipient: to,
      title: `Order ${order.orderNumber} — ${label}`,
      orderNumber: order.orderNumber,
      success: result.success,
      skipped: result.skipped,
      error: result.error,
      messageId: result.messageId,
    });

    if (result.skipped || !result.success) {
      await this.clearStatusFlag(order._id, status);
    }
  }

  async sendOrderDelivered(
    order: OrderDocument,
    deliveryMessage?: string,
    emailChannel?: EmailSenderChannel,
    buyer?: BuyerLike,
  ): Promise<void> {
    await this.trySendStatusEmail(
      order,
      'delivered',
      deliveryMessage,
      emailChannel,
      buyer,
    );
  }

  async sendOrderNote(
    order: OrderDocument,
    message: string,
    emailChannel?: EmailSenderChannel,
    buyer?: BuyerLike,
  ): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    if (!(await this.isOrderCustomerEmailEnabled(order.orderNumber, 'customer note'))) {
      return;
    }
    if (
      !(await this.isCustomerTemplateEnabled(
        order.orderNumber,
        ORDER_CUSTOMER_NOTE_TEMPLATE_ID,
        'customer note',
      ))
    ) {
      return;
    }
    const resolvedBuyer = buyer ?? (await this.loadBuyer(order));
    const to = this.resolveCustomerEmail(order, resolvedBuyer);
    if (!to) {
      this.logger.warn(
        `Order ${order.orderNumber}: no customer email for order note`,
      );
      return;
    }

    const isGuest = this.isGuestBuyer(resolvedBuyer);
    const result = await this.mailer.sendOrderCustomerNote(
      to,
      {
        name: this.resolveCustomerName(order, resolvedBuyer),
        orderNumber: order.orderNumber,
        message: trimmed,
        orderUrl: buildCustomerOrderEmailPath(
          order,
          isGuest,
          this.guestReceiptToken(order, isGuest),
        ),
      },
      emailChannel,
    );

    this.logSendResult('order note', order.orderNumber, to, result);
    await this.emailDeliveryLog.recordDirectSend({
      userId: String(order.userId),
      event: ORDER_CUSTOMER_NOTE_TEMPLATE_ID,
      recipient: to,
      title: `Message for order ${order.orderNumber}`,
      orderNumber: order.orderNumber,
      success: result.success,
      skipped: result.skipped,
      error: result.error,
      messageId: result.messageId,
    });
  }

  /** Customer email when a gateway/MFS payment attempt fails. */
  async sendPaymentFailed(
    order: OrderDocument,
    reason: string,
    buyer?: BuyerLike,
  ): Promise<void> {
    const label = 'payment failed';
    if (!(await this.isOrderCustomerEmailEnabled(order.orderNumber, label))) {
      return;
    }
    if (
      !(await this.isCustomerTemplateEnabled(
        order.orderNumber,
        ORDER_FAILED_TEMPLATE_ID,
        label,
      ))
    ) {
      return;
    }

    const resolvedBuyer = buyer ?? (await this.loadBuyer(order));
    const to = this.resolveCustomerEmail(order, resolvedBuyer);
    if (!to) {
      this.logger.warn(
        `Order ${order.orderNumber}: no customer email for payment failure notice`,
      );
      return;
    }

    const isGuest = this.isGuestBuyer(resolvedBuyer);
    const result = await this.mailer.sendPaymentFailed(to, {
      name: this.resolveCustomerName(order, resolvedBuyer),
      orderNumber: order.orderNumber,
      amount: order.pricing.total,
      currency: order.pricing.currency,
      reason: reason.trim() || 'Payment could not be completed.',
      retryUrl: buildCustomerOrderEmailPath(
        order,
        isGuest,
        this.guestReceiptToken(order, isGuest),
      ),
    });

    this.logSendResult(label, order.orderNumber, to, result);
    await this.emailDeliveryLog.recordDirectSend({
      userId: String(order.userId),
      event: ORDER_FAILED_TEMPLATE_ID,
      recipient: to,
      title: `Order ${order.orderNumber} — payment failed`,
      orderNumber: order.orderNumber,
      success: result.success,
      skipped: result.skipped,
      error: result.error,
      messageId: result.messageId,
    });
  }

  private async clearStatusFlag(
    orderId: unknown,
    status: CustomerOrderEmailStatus,
  ): Promise<void> {
    const field = STATUS_FLAG_FIELD[status].replace('customerEmails.', '');
    await this.orderModel
      .updateOne({ _id: orderId }, { $unset: { [`customerEmails.${field}`]: '' } })
      .exec();
  }

  private async isOrderCustomerEmailEnabled(
    orderNumber: string,
    label: string,
  ): Promise<boolean> {
    const settings = await this.emailSettings.getEffective();
    if (!settings.orderCustomerEmailsEnabled) {
      this.logger.warn(
        `Order ${orderNumber}: ${label} email skipped — customer order emails are disabled in Email settings`,
      );
      return false;
    }
    return true;
  }

  private async isCustomerTemplateEnabled(
    orderNumber: string,
    templateId: string | null,
    label: string,
  ): Promise<boolean> {
    if (!templateId) {
      this.logger.warn(
        `Order ${orderNumber}: ${label} email skipped — no enabled payment receipt template (enable Paid Order or Invoice)`,
      );
      return false;
    }
    const enabled = await this.emailTemplates.isTemplateEnabled(templateId);
    if (!enabled) {
      this.logger.warn(
        `Order ${orderNumber}: ${label} email skipped — template "${templateId}" is disabled in Email template library`,
      );
      return false;
    }
    return true;
  }

  /** Paid Order takes priority; Invoice is the fallback receipt template. */
  private async resolvePaidReceiptTemplateId(): Promise<string | null> {
    if (
      await this.emailTemplates.isTemplateEnabled(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid,
      )
    ) {
      return ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid;
    }
    if (await this.emailTemplates.isTemplateEnabled(ORDER_INVOICE_TEMPLATE_ID)) {
      return ORDER_INVOICE_TEMPLATE_ID;
    }
    return null;
  }

  private async loadBuyer(order: OrderDocument): Promise<BuyerLike> {
    if (!order.userId) {
      return null;
    }
    return this.userModel
      .findById(order.userId)
      .select('isGuest email profile')
      .lean()
      .exec();
  }

  private resolveCustomerEmail(
    order: OrderDocument,
    buyer?: BuyerLike,
  ): string | null {
    const contactEmail = order.contact?.email?.trim().toLowerCase();
    if (contactEmail && !isGuestMailbox(contactEmail)) {
      return contactEmail;
    }

    const accountEmail = buyer?.email?.trim().toLowerCase();
    if (accountEmail && !isGuestMailbox(accountEmail)) {
      return accountEmail;
    }

    return contactEmail || accountEmail || null;
  }

  private resolveCustomerName(
    order: OrderDocument,
    buyer?: BuyerLike,
  ): string | undefined {
    const fromContact = order.contact?.fullName?.trim();
    if (fromContact) {
      return fromContact;
    }
    return (
      buyer?.profile?.displayName?.trim() ||
      buyer?.profile?.firstName?.trim() ||
      buyer?.email?.split('@')[0]
    );
  }

  private isGuestBuyer(buyer?: BuyerLike): boolean {
    if (!buyer) {
      return false;
    }
    return isEphemeralGuestUser(buyer);
  }

  private logSendResult(
    label: string,
    orderNumber: string,
    to: string,
    result: { success: boolean; skipped?: boolean; error?: string },
  ): void {
    if (result.skipped) {
      this.logger.warn(
        `${label} email skipped for order ${orderNumber} to ${to} — check Admin → Email (SMTP enabled, mock off, template library enabled)`,
      );
      return;
    }
    if (!result.success) {
      this.logger.error(
        `${label} email failed for order ${orderNumber} to ${to}: ${result.error ?? 'unknown error'}`,
      );
      return;
    }
    this.logger.log(`${label} email sent for order ${orderNumber} to ${to}`);
  }
}
