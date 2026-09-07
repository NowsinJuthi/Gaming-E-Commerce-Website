import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  OrderJob,
  OrderJobData,
  ORDERS_QUEUE,
} from '../../queues/queue.constants';
import { OrderService } from './order.service';

/**
 * BullMQ worker driving the order workflow:
 *  - fulfill: deliver inventory + redeem coupon/voucher after payment
 *  - expire:  release reservation + cancel if unpaid in time
 *  - refund:  disable codes + mark refunded
 */
@Processor(ORDERS_QUEUE)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(private readonly orders: OrderService) {
    super();
  }

  async process(job: Job<OrderJobData>): Promise<void> {
    const { orderId, reason } = job.data;
    this.logger.log(`Processing ${job.name} for order ${orderId}`);

    switch (job.name) {
      case OrderJob.Fulfill:
        await this.orders.processFulfillment(orderId);
        break;
      case OrderJob.Expire:
        await this.orders.processExpiration(orderId);
        break;
      case OrderJob.Refund:
        await this.orders.processRefund(orderId, reason);
        break;
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }
}
