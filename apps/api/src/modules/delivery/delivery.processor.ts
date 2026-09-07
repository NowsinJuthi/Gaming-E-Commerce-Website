import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  DeliveryJob,
  DeliveryJobData,
  DELIVERY_QUEUE,
} from '../../queues/queue.constants';
import { DeliveryService } from './delivery.service';

/**
 * BullMQ worker for the auto-delivery pipeline. Throwing from `process` lets
 * BullMQ apply the configured retry strategy (exponential backoff); once the
 * attempt budget is spent the `failed` event hands off to a recovery path.
 */
@Processor(DELIVERY_QUEUE)
export class DeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(private readonly delivery: DeliveryService) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(
      `Delivering order ${orderId} (attempt ${job.attemptsMade + 1})`,
    );
    switch (job.name) {
      case DeliveryJob.Deliver:
        await this.delivery.deliverOrder(orderId);
        break;
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DeliveryJobData>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Delivery attempt ${job.attemptsMade}/${maxAttempts} failed for order ${job.data.orderId}: ${error.message}`,
      );
      return;
    }
    await this.delivery.handleExhausted(job.data.orderId, error.message);
  }
}
