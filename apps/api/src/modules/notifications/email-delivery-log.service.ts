import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../../common/enums';
import {
  NotificationDelivery,
  NotificationDeliveryDocument,
} from '../../database/schemas/notification-delivery.schema';

type DirectEmailLogInput = {
  userId: string;
  event: string;
  recipient: string;
  title: string;
  orderNumber?: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
};

@Injectable()
export class EmailDeliveryLogService {
  constructor(
    @InjectModel(NotificationDelivery.name)
    private readonly deliveryModel: Model<NotificationDeliveryDocument>,
  ) {}

  async recordDirectSend(input: DirectEmailLogInput): Promise<void> {
    const userId = input.userId?.trim();
    if (!userId) return;

    const status = input.skipped
      ? NotificationDeliveryStatus.Skipped
      : input.success
        ? NotificationDeliveryStatus.Sent
        : NotificationDeliveryStatus.Failed;

    await this.deliveryModel.create({
      userId: new Types.ObjectId(userId),
      event: input.event,
      channel: NotificationChannel.Email,
      status,
      recipient: input.recipient,
      title: input.title,
      orderNumber: input.orderNumber?.trim() || undefined,
      providerRef: input.messageId,
      error: input.error,
      attempts: 1,
    });
  }
}
