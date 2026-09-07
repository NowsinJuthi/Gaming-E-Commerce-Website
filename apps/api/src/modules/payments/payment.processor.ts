import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PaymentJob,
  PaymentJobData,
  PAYMENTS_QUEUE,
} from '../../queues/queue.constants';
import { PaymentService } from './payment.service';

/**
 * BullMQ worker for the payment retry workflow. Re-verifies pending intents
 * with exponential backoff until they settle or attempts are exhausted.
 */
@Processor(PAYMENTS_QUEUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(private readonly payments: PaymentService) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<void> {
    const { intentId, attempt } = job.data;
    this.logger.log(
      `Processing ${job.name} for intent ${intentId} (attempt ${attempt})`,
    );

    switch (job.name) {
      case PaymentJob.Verify:
        await this.payments.pollVerify(intentId, attempt);
        break;
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }
}
