import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEvent,
  OrderStatus,
} from '../../common/enums';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { escapeRegex } from '../../common/utils/escape-regex';
import {
  NotificationDelivery,
  NotificationDeliveryDocument,
} from '../../database/schemas/notification-delivery.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { Product, ProductDocument } from '../../database/schemas/product.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { EmailSettingsService } from '../../integrations/mail/email-settings.service';
import { MailerService } from '../../integrations/mail/mailer.service';
import { createGuestOrderAccessToken } from '../../common/utils/guest-order-access';
import { resolveGuestOrderAccessSecret } from '../../common/utils/guest-order-secret';
import { buildCustomerOrderEmailPath } from '../../common/utils/guest-order-url';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';
import { buildEmailOrderItemsFromOrder } from '../orders/order-email-items.util';
import { buildDeliveryPreviewContent } from './email-delivery-preview.util';
import {
  NOTIFICATIONS_QUEUE,
} from '../../queues/queue.constants';
import { NOTIFICATION_TEMPLATES } from './notification-templates';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto';
import { TelegramSettingsService } from './telegram-settings.service';

@Injectable()
export class NotificationAdminService {
  private readonly accessSecret: string;

  constructor(
    @InjectModel(NotificationDelivery.name)
    private readonly deliveryModel: Model<NotificationDeliveryDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly emailSettings: EmailSettingsService,
    private readonly telegramSettings: TelegramSettingsService,
  ) {
    this.accessSecret = resolveGuestOrderAccessSecret(this.config);
  }

  async overview(): Promise<{
    channels: {
      email: {
        configured: boolean;
        from: string;
        enabled: boolean;
        mockMode: boolean;
        host?: string;
      };
      push: { configured: boolean };
      telegram: {
        configured: boolean;
        enabled: boolean;
        notifyOnOrderPlaced: boolean;
        notifyOnCustomerChat: boolean;
      };
    };
    queue: { waiting: number; active: number; failed: number };
    deliveries: {
      sent: number;
      failed: number;
      skipped: number;
      pending: number;
    };
    events: Array<{
      event: string;
      type: string;
      defaultChannels: string[];
    }>;
  }> {
    const mail = this.config.get<{ host?: string; fromEmail: string }>('mail');
    const push = this.config.get<{ fcmServerKey?: string }>(
      'notifications.push',
    );
    const telegram = this.config.get<{ botToken?: string }>(
      'notifications.telegram',
    );
    const [effective, smtp, smtpReady, telegramSettings] = await Promise.all([
      this.emailSettings.getEffective(),
      this.emailSettings.getEffectiveSmtp(),
      this.mailer.isConfigured(),
      this.telegramSettings.getSettings(),
    ]);
    const emailLive =
      smtpReady && effective.enabled && !effective.mockMode && Boolean(smtp.host);

    const [waiting, active, failed, deliveryCounts] = await Promise.all([
      this.queue.getWaitingCount().catch(() => 0),
      this.queue.getActiveCount().catch(() => 0),
      this.queue.getFailedCount().catch(() => 0),
      this.deliveryModel
        .aggregate<{ _id: NotificationDeliveryStatus; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const counts = {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };
    for (const row of deliveryCounts) {
      if (row._id === NotificationDeliveryStatus.Sent) counts.sent = row.count;
      else if (row._id === NotificationDeliveryStatus.Failed)
        counts.failed = row.count;
      else if (row._id === NotificationDeliveryStatus.Skipped)
        counts.skipped = row.count;
      else if (row._id === NotificationDeliveryStatus.Pending)
        counts.pending = row.count;
    }

    const events = Object.values(NotificationEvent).map((event) => {
      const template = NOTIFICATION_TEMPLATES[event];
      return {
        event,
        type: template.type,
        defaultChannels: template.defaultChannels,
      };
    });

    return {
      channels: {
        email: {
          configured: emailLive,
          from: effective.fromEmail || mail?.fromEmail || 'no-reply@uniqbd.com',
          enabled: effective.enabled,
          mockMode: effective.mockMode,
          host: smtp.host,
        },
        push: { configured: Boolean(push?.fcmServerKey) },
        telegram: {
          configured: telegramSettings.configured || Boolean(telegram?.botToken),
          enabled: telegramSettings.enabled,
          notifyOnOrderPlaced: telegramSettings.notifyOnOrderPlaced,
          notifyOnCustomerChat: telegramSettings.notifyOnCustomerChat,
        },
      },
      queue: { waiting, active, failed },
      deliveries: counts,
      events,
    };
  }

  async listDeliveries(
    query: QueryDeliveriesDto,
  ): Promise<PaginatedResult<NotificationDeliveryDocument>> {
    const filter: FilterQuery<NotificationDeliveryDocument> = {};
    if (query.channel) {
      filter.channel = query.channel;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const searchTerm = query.search?.trim();
    const isEmailChannel = query.channel === NotificationChannel.Email;

    if (searchTerm) {
      filter.$or = await this.buildDeliverySearchOr(searchTerm);
    } else if ((query.from || query.to) && !isEmailChannel) {
      const createdAt: FilterQuery<NotificationDeliveryDocument>['createdAt'] =
        {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }

    const { page, limit } = query;

    if (isEmailChannel) {
      const channelFilter: FilterQuery<NotificationDeliveryDocument> = {};
      if (query.channel) channelFilter.channel = query.channel;
      if (query.status) channelFilter.status = query.status;
      return this.listEmailDeliveries(query, channelFilter);
    }

    const total = await this.deliveryModel.countDocuments(filter).exec();

    const items = await this.deliveryModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return { items, total, page, limit };
  }

  private async listEmailDeliveries(
    query: QueryDeliveriesDto,
    channelFilter: FilterQuery<NotificationDeliveryDocument>,
  ): Promise<PaginatedResult<NotificationDeliveryDocument>> {
    const { page, limit } = query;
    const searchTerm = query.search?.trim();
    const emailFilter: FilterQuery<NotificationDeliveryDocument> = {
      ...channelFilter,
    };

    if (searchTerm) {
      emailFilter.$or = await this.buildDeliverySearchOr(searchTerm);
    } else if (query.from || query.to) {
      const deliveredAt: FilterQuery<OrderDocument>['deliveredAt'] = {
        $ne: null,
      };
      if (query.from) deliveredAt.$gte = new Date(query.from);
      if (query.to) deliveredAt.$lte = new Date(query.to);

      const periodDelivered = await this.orderModel
        .find({
          status: OrderStatus.Delivered,
          deliveredAt,
        })
        .sort({ deliveredAt: -1 })
        .select('orderNumber')
        .lean()
        .exec();

      const orderClauses = this.buildRecentOrderEmailClauses(
        periodDelivered.map((order) => order.orderNumber),
      );

      const createdAt: FilterQuery<NotificationDeliveryDocument>['createdAt'] =
        {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      if (orderClauses.length > 0) {
        emailFilter.$or = [{ createdAt }, ...orderClauses];
      } else {
        emailFilter.createdAt = createdAt;
      }
    }

    const total = await this.deliveryModel.countDocuments(emailFilter).exec();
    const items = await this.deliveryModel
      .find(emailFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return { items, total, page, limit };
  }

  async previewEmailDelivery(id: string): Promise<{
    available: boolean;
    subject?: string;
    html?: string;
    recipient?: string;
    title?: string;
    note?: string;
  }> {
    const doc = await this.deliveryModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Email log not found');
    }
    if (doc.channel !== NotificationChannel.Email) {
      throw new BadRequestException('Only email delivery logs can be previewed');
    }

    const [order, user, settings] = await Promise.all([
      doc.orderNumber
        ? this.orderModel.findOne({ orderNumber: doc.orderNumber }).exec()
        : Promise.resolve(null),
      this.userModel
        .findById(doc.userId)
        .select('profile email isGuest')
        .lean()
        .exec(),
      this.emailSettings.getEffective(),
    ]);

    const name =
      order?.contact?.fullName?.trim() ||
      user?.profile?.displayName ||
      user?.profile?.firstName ||
      user?.email?.split('@')[0];
    const recipient =
      doc.recipient ?? order?.contact?.email ?? user?.email ?? undefined;
    const isGuest = user ? isEphemeralGuestUser(user) : false;
    const orderUrl = order
      ? buildCustomerOrderEmailPath(
          order,
          isGuest,
          isGuest
            ? createGuestOrderAccessToken(
                String(order._id),
                order.orderNumber,
                this.accessSecret,
              )
            : undefined,
        )
      : undefined;
    const items = order
      ? await buildEmailOrderItemsFromOrder(
          order.items ?? [],
          this.productModel,
          settings,
        )
      : undefined;

    const built = buildDeliveryPreviewContent({
      event: doc.event,
      title: doc.title,
      settings,
      order,
      name,
      orderUrl,
      items,
      recipient,
    });

    if (!built) {
      return {
        available: false,
        recipient,
        title: doc.title,
        note: 'Email preview is not available for this log entry.',
      };
    }

    if (built.kind === 'generic') {
      return {
        available: true,
        subject: built.content.subject,
        html: built.content.html,
        recipient,
        title: doc.title,
        note: 'Reconstructed from log metadata. Exact sent content may differ.',
      };
    }

    const merged = await this.mailer.renderEmailContent(
      built.templateId,
      built.content,
      built.vars,
    );

    if (!merged?.html) {
      return {
        available: false,
        recipient,
        title: doc.title,
        note: 'Template is disabled or has no HTML preview.',
      };
    }

    return {
      available: true,
      subject: merged.subject || doc.title,
      html: merged.html,
      recipient,
      title: doc.title,
      note: 'Reconstructed from order data and the current email template.',
    };
  }

  async deleteEmailDelivery(id: string): Promise<{ deleted: boolean }> {
    const doc = await this.deliveryModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Email log not found');
    }
    if (doc.channel !== NotificationChannel.Email) {
      throw new BadRequestException('Only email delivery logs can be deleted');
    }
    await doc.deleteOne();
    return { deleted: true };
  }

  async deleteEmailDeliveries(ids: string[]): Promise<{ deleted: number }> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No email logs selected');
    }

    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));
    const result = await this.deliveryModel.deleteMany({
      _id: { $in: objectIds },
      channel: NotificationChannel.Email,
    });
    return { deleted: result.deletedCount ?? 0 };
  }

  private buildRecentOrderEmailClauses(
    recentOrderNumbers: string[],
  ): FilterQuery<NotificationDeliveryDocument>[] {
    if (recentOrderNumbers.length === 0) {
      return [];
    }
    return [
      { orderNumber: { $in: recentOrderNumbers } },
      ...recentOrderNumbers.map((orderNumber) => ({
        title: { $regex: escapeRegex(orderNumber), $options: 'i' },
      })),
    ];
  }

  private async buildDeliverySearchOr(
    term: string,
  ): Promise<FilterQuery<NotificationDeliveryDocument>[]> {
    const rx = escapeRegex(term);
    const rxOpts = { $regex: rx, $options: 'i' };
    const or: FilterQuery<NotificationDeliveryDocument>[] = [
      { recipient: rxOpts },
      { title: rxOpts },
    ];

    const userIds = new Set<string>();
    const recipientEmails = new Set<string>();

    const users = await this.userModel
      .find({ $or: [{ email: rxOpts }, { phone: rxOpts }] })
      .select('_id email')
      .limit(30)
      .lean()
      .exec();
    for (const user of users) {
      userIds.add(String(user._id));
      if (user.email) recipientEmails.add(user.email);
    }

    const orderOr: FilterQuery<OrderDocument>[] = [
      { orderNumber: rxOpts },
      { 'contact.email': rxOpts },
      { 'contact.mobile': rxOpts },
    ];
    const phoneDigits = term.replace(/\D/g, '');
    if (phoneDigits.length >= 4 && phoneDigits !== term) {
      orderOr.push({
        'contact.mobile': {
          $regex: escapeRegex(phoneDigits),
          $options: 'i',
        },
      });
    }

    const orders = await this.orderModel
      .find({ $or: orderOr })
      .select('userId contact.email')
      .limit(40)
      .lean()
      .exec();
    for (const order of orders) {
      userIds.add(String(order.userId));
      const email = order.contact?.email?.trim();
      if (email) recipientEmails.add(email);
    }

    if (userIds.size > 0) {
      or.push({
        userId: {
          $in: [...userIds].map((id) => new Types.ObjectId(id)),
        },
      });
    }
    if (recipientEmails.size > 0) {
      or.push({ recipient: { $in: [...recipientEmails] } });
    }

    return or;
  }
}
