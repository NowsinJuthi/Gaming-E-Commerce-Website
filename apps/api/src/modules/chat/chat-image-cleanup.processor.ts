import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ChatJob,
  ChatJobData,
  CHAT_QUEUE,
} from '../../queues/queue.constants';
import { ChatImageCleanupService } from './chat-image-cleanup.service';

/**
 * BullMQ worker for chat image cleanup jobs:
 * - cleanup-old-images: delete chat image attachments older than 90 days
 */
@Processor(CHAT_QUEUE)
export class ChatImageCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatImageCleanupProcessor.name);

  constructor(private readonly cleanupService: ChatImageCleanupService) {
    super();
  }

  async process(job: Job<ChatJobData>): Promise<{
    deletedCount: number;
    referenceRemovedCount: number;
    errors: string[];
  }> {
    this.logger.log(`Processing ${job.name} job`);

    switch (job.name) {
      case ChatJob.CleanupOldImages:
        return await this.cleanupService.cleanupOldImages(job.data);
      default:
        this.logger.warn(`Unknown job ${job.name}`);
        return { deletedCount: 0, referenceRemovedCount: 0, errors: ['Unknown job type'] };
    }
  }
}
