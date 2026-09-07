import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { SupplierOrderStatus } from '../../common/enums';
import {
  SupplierOrder,
  SupplierOrderDocument,
} from '../../database/schemas/supplier-order.schema';
import {
  DeliveryJob,
  DeliveryJobData,
  DELIVERY_JOB_OPTIONS,
  DELIVERY_QUEUE,
} from '../../queues/queue.constants';
import { CacheService } from '../../shared/cache/cache.service';
import { DeliveryService } from './delivery.service';
import { DeliverySettingsService } from './delivery-settings.service';

export interface DeliveryPipelineStep {
  key: string;
  label: string;
  description: string;
}

@Injectable()
export class DeliveryAdminService {
  private readonly logger = new Logger(DeliveryAdminService.name);

  constructor(
    @InjectQueue(DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
    @InjectModel(SupplierOrder.name)
    private readonly supplierOrderModel: Model<SupplierOrderDocument>,
    private readonly cache: CacheService,
    private readonly delivery: DeliveryService,
    private readonly settings: DeliverySettingsService,
  ) {}

  async overview() {
    const [queue, redis, supplierAttempts, failedJobs, deliverySettings] =
      await Promise.all([
      this.queueCounts(),
      this.redisStatus(),
      this.recentSupplierAttempts(),
      this.recentFailedJobs(),
      this.settings.getSettings(),
    ]);

    const enabledTemplates = deliverySettings.customOrderFields.filter(
      (f) => f.enabled,
    ).length;
    const enabledMessages = deliverySettings.customOrderFields
      .filter((f) => f.enabled)
      .reduce(
        (sum, f) => sum + f.messages.filter((m) => m.trim()).length,
        0,
      );

    return {
      pipeline: this.pipelineSteps(),
      customOrderFields: {
        total: deliverySettings.customOrderFields.length,
        enabled: enabledMessages || enabledTemplates,
      },
      retryStrategy: {
        attempts: DELIVERY_JOB_OPTIONS.attempts,
        backoff: DELIVERY_JOB_OPTIONS.backoff,
        removeOnComplete: DELIVERY_JOB_OPTIONS.removeOnComplete,
        removeOnFail: DELIVERY_JOB_OPTIONS.removeOnFail,
      },
      queue,
      redis,
      supplierAttempts,
      failedJobs,
    };
  }

  /** Re-enqueue delivery for an order (manual retry from admin). */
  async retryDelivery(orderId: string): Promise<{ queued: boolean }> {
    try {
      await this.deliveryQueue.add(
        DeliveryJob.Deliver,
        { orderId },
        {
          ...DELIVERY_JOB_OPTIONS,
          jobId: `deliver:${orderId}:manual:${Date.now()}`,
        },
      );
      return { queued: true };
    } catch (queueError) {
      this.logger.warn(
        `Delivery queue unavailable, retrying synchronously for ${orderId}: ${
          queueError instanceof Error ? queueError.message : String(queueError)
        }`,
      );
      await this.delivery.deliverOrder(orderId);
      return { queued: false };
    }
  }

  private pipelineSteps(): DeliveryPipelineStep[] {
    return [
      {
        key: 'payment',
        label: 'Payment',
        description: 'Order marked paid after wallet or gateway settlement',
      },
      {
        key: 'queue',
        label: 'Queue',
        description: 'BullMQ delivery job enqueued on Redis',
      },
      {
        key: 'supplier',
        label: 'Supplier',
        description: 'Procure codes from suppliers with automatic failover',
      },
      {
        key: 'delivery',
        label: 'Delivery',
        description: 'Attach codes to order items and finalize stock',
      },
      {
        key: 'notification',
        label: 'Notification',
        description: 'Notify buyer of delivery or delay via event channels',
      },
    ];
  }

  private async queueCounts(): Promise<Record<string, unknown>> {
    const redisReachable = await this.isRedisReachable();
    if (!redisReachable) {
      return {
        ok: false,
        name: DELIVERY_QUEUE,
        redisOffline: true,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: 'Redis offline — manual retry uses sync delivery fallback',
      };
    }

    try {
      const counts = await this.deliveryQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      return { ok: true, name: DELIVERY_QUEUE, ...counts };
    } catch (error) {
      const message = (error as Error).message;
      return {
        ok: false,
        name: DELIVERY_QUEUE,
        error:
          message === 'Connection is closed'
            ? 'Redis connection lost'
            : message,
      };
    }
  }

  private async isRedisReachable(): Promise<boolean> {
    try {
      const pong = await this.cache.redis.ping();
      return pong === 'PONG' && this.cache.redis.status === 'ready';
    } catch {
      return false;
    }
  }

  private async redisStatus(): Promise<{ ok: boolean; state?: string; error?: string }> {
    try {
      await this.cache.redis.ping();
      return { ok: this.cache.redis.status === 'ready', state: this.cache.redis.status };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async recentSupplierAttempts(): Promise<
    Array<{
      id: string;
      orderId?: string;
      supplierCode: string;
      status: string;
      attempt: number;
      error?: string;
      createdAt?: Date;
    }>
  > {
    const rows = await this.supplierOrderModel
      .find({
        status: {
          $in: [
            SupplierOrderStatus.Failed,
            SupplierOrderStatus.Pending,
          ],
        },
      })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean()
      .exec();

    return rows.map((row) => ({
      id: String(row._id),
      orderId: row.orderId ? String(row.orderId) : undefined,
      supplierCode: row.supplierCode,
      status: row.status,
      attempt: row.attempt,
      error: row.error,
      createdAt: row.createdAt,
    }));
  }

  private async recentFailedJobs(): Promise<
    Array<{
      id: string;
      orderId: string;
      attemptsMade: number;
      failedReason?: string;
      finishedOn?: number;
    }>
  > {
    try {
      const jobs = await this.deliveryQueue.getJobs(['failed'], 0, 10);
      return jobs.map((job) => ({
        id: job.id ?? '',
        orderId: job.data.orderId,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
      }));
    } catch {
      return [];
    }
  }
}
