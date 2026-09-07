import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../../common/enums';
import {
  NotificationDelivery,
  NotificationDeliveryDocument,
} from '../../database/schemas/notification-delivery.schema';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJob,
  NotificationJobData,
} from '../../queues/queue.constants';
import { ChannelRegistry } from './channels/channel.registry';

/**
 * Delivers queued notifications over external channels. Throwing on a failed
 * send lets BullMQ apply the configured retry/backoff; every attempt is logged
 * to the delivery audit collection.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly registry: ChannelRegistry,
    @InjectModel(NotificationDelivery.name)
    private readonly deliveryModel: Model<NotificationDeliveryDocument>,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    if (job.name !== NotificationJob.Send) {
      this.logger.warn(`Unknown job ${job.name}`);
      return;
    }

    const data = job.data;
    const channel = data.channel as NotificationChannel;
    const adapter = this.registry.get(channel);
    const attempts = job.attemptsMade + 1;

    if (!adapter) {
      await this.log(data, NotificationDeliveryStatus.Failed, attempts, {
        error: `No adapter for channel ${data.channel}`,
      });
      return; // unknown channel is not retriable
    }

    const result = await adapter.send({
      userId: data.userId,
      recipient: data.recipient,
      title: data.title,
      body: data.body,
      event: data.event,
      data: data.data,
    });

    if (result.success) {
      await this.log(
        data,
        result.skipped
          ? NotificationDeliveryStatus.Skipped
          : NotificationDeliveryStatus.Sent,
        attempts,
        { providerRef: result.providerRef },
      );
      return;
    }

    await this.log(data, NotificationDeliveryStatus.Failed, attempts, {
      error: result.error,
    });
    throw new Error(
      `Channel ${data.channel} delivery failed: ${result.error ?? 'unknown error'}`,
    );
  }

  private async log(
    data: NotificationJobData,
    status: NotificationDeliveryStatus,
    attempts: number,
    extra: { providerRef?: string; error?: string },
  ): Promise<void> {
    await this.deliveryModel.create({
      userId: new Types.ObjectId(data.userId),
      event: data.event,
      channel: data.channel as NotificationChannel,
      status,
      recipient: data.recipient,
      title: data.title,
      orderNumber: this.extractOrderNumber(data),
      attempts,
      providerRef: extra.providerRef,
      error: extra.error,
    });
  }

  private extractOrderNumber(data: NotificationJobData): string | undefined {
    const fromData = data.data?.orderNumber;
    if (typeof fromData === 'string' && fromData.trim()) {
      return fromData.trim();
    }
    if (typeof fromData === 'number') {
      return String(fromData);
    }
    return undefined;
  }
}
