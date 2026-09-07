import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { NotificationAudience, NotificationType } from '../../common/enums';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  Notification,
  NotificationDocument,
} from '../../database/schemas/notification.schema';

interface CreateNotificationInput {
  userId: string | Types.ObjectId;
  title: string;
  type?: NotificationType;
  audience?: NotificationAudience;
  body?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  private excludeChatFilter(): FilterQuery<NotificationDocument> {
    return { 'data.chat': { $ne: true } };
  }

  private audienceFilter(
    audience?: NotificationAudience,
  ): FilterQuery<NotificationDocument> {
    const resolved = audience ?? NotificationAudience.Customer;
    if (resolved === NotificationAudience.Staff) {
      return { audience: NotificationAudience.Staff };
    }
    return {
      $or: [
        { audience: NotificationAudience.Customer },
        { audience: { $exists: false } },
      ],
    };
  }

  create(input: CreateNotificationInput): Promise<NotificationDocument> {
    return this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type ?? NotificationType.System,
      audience: input.audience ?? NotificationAudience.Customer,
      title: input.title,
      body: input.body,
      data: input.data,
    });
  }

  async listForUser(
    userId: string,
    pagination: PaginationDto,
    audience?: NotificationAudience,
    excludeChat = false,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter: FilterQuery<NotificationDocument> = {
      userId: new Types.ObjectId(userId),
      ...this.audienceFilter(audience),
      ...(excludeChat ? this.excludeChatFilter() : {}),
    };
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  async unreadCount(
    userId: string,
    audience?: NotificationAudience,
    chatOnly = false,
    excludeChat = false,
  ): Promise<{ count: number }> {
    const filter: FilterQuery<NotificationDocument> = {
      userId: new Types.ObjectId(userId),
      read: false,
      ...this.audienceFilter(audience),
    };
    if (chatOnly) {
      filter['data.chat'] = true;
    } else if (excludeChat) {
      Object.assign(filter, this.excludeChatFilter());
    }
    const count = await this.notificationModel.countDocuments(filter).exec();
    return { count };
  }

  async markRead(
    userId: string,
    notificationId: Types.ObjectId,
  ): Promise<{ success: boolean }> {
    const result = await this.notificationModel
      .updateOne(
        { _id: notificationId, userId: new Types.ObjectId(userId) },
        { $set: { read: true, readAt: new Date() } },
      )
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  async markAllRead(
    userId: string,
    audience?: NotificationAudience,
  ): Promise<{ success: boolean }> {
    await this.notificationModel
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          read: false,
          ...this.audienceFilter(audience),
        },
        { $set: { read: true, readAt: new Date() } },
      )
      .exec();
    return { success: true };
  }

  /** One unread in-app alert per user per chat room; body updates on new messages. */
  async upsertChatNotification(input: {
    userId: string | Types.ObjectId;
    audience: NotificationAudience;
    roomId: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }): Promise<NotificationDocument> {
    const uid = new Types.ObjectId(input.userId);
    const data = {
      chat: true,
      roomId: input.roomId,
      ...input.data,
    };
    const filter: FilterQuery<NotificationDocument> = {
      userId: uid,
      read: false,
      audience: input.audience,
      'data.chat': true,
      'data.roomId': input.roomId,
    };

    const existing = await this.notificationModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            type: NotificationType.System,
            title: input.title,
            body: input.body,
            data,
          },
        },
        { new: true, sort: { createdAt: -1 } },
      )
      .exec();

    if (existing) {
      await this.notificationModel
        .updateMany(
          { ...filter, _id: { $ne: existing._id } },
          { $set: { read: true, readAt: new Date() } },
        )
        .exec();
      return existing;
    }

    return this.create({
      userId: uid,
      audience: input.audience,
      title: input.title,
      body: input.body,
      data,
    });
  }

  async markChatRoomRead(
    userId: string,
    roomId: string,
    audience: NotificationAudience,
  ): Promise<{ success: boolean }> {
    const filter: FilterQuery<NotificationDocument> = {
      userId: new Types.ObjectId(userId),
      read: false,
      'data.chat': true,
      'data.roomId': roomId,
      ...(audience === NotificationAudience.Staff
        ? { audience: NotificationAudience.Staff }
        : this.audienceFilter(NotificationAudience.Customer)),
    };
    await this.notificationModel
      .updateMany(filter, { $set: { read: true, readAt: new Date() } })
      .exec();
    return { success: true };
  }

  async markAllChatRead(
    userId: string,
    audience?: NotificationAudience,
  ): Promise<{ success: boolean }> {
    const resolved = audience ?? NotificationAudience.Customer;
    const filter: FilterQuery<NotificationDocument> = {
      userId: new Types.ObjectId(userId),
      read: false,
      'data.chat': true,
      ...(resolved === NotificationAudience.Staff
        ? { audience: NotificationAudience.Staff }
        : this.audienceFilter(NotificationAudience.Customer)),
    };
    await this.notificationModel
      .updateMany(filter, { $set: { read: true, readAt: new Date() } })
      .exec();
    return { success: true };
  }
}
