import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from '../../database/schemas/chat-message.schema';
import { ChatJob, ChatJobData, CHAT_QUEUE, CHAT_JOB_OPTIONS } from '../../queues/queue.constants';
import { UploadsService } from '../../shared/uploads/uploads.service';

const DEFAULT_RETENTION_DAYS = 90;

@Injectable()
export class ChatImageCleanupService {
  private readonly logger = new Logger(ChatImageCleanupService.name);

  constructor(
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
    @InjectQueue(CHAT_QUEUE)
    private readonly chatQueue: Queue,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Scheduled job that runs daily at midnight (UTC) to clean up old chat images.
   * This is the cron job trigger that enqueues the actual cleanup work.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleDailyCleanup(): Promise<void> {
    this.logger.log('Scheduling daily chat image cleanup job');
    // Use date-based jobId to prevent duplicate jobs on the same day
    const today = new Date().toISOString().split('T')[0];
    const jobId = `chat-image-cleanup-${today}`;
    
    await this.chatQueue.add(
      ChatJob.CleanupOldImages,
      { olderThanDays: DEFAULT_RETENTION_DAYS } as ChatJobData,
      {
        jobId,
        ...CHAT_JOB_OPTIONS,
      },
    );
  }

  /**
   * Check if an image URL is referenced by any other chat message.
   * @param imageUrl - The image URL to check
   * @param excludeMessageId - The message ID to exclude from the check
   * @returns true if the image is referenced by another message
   */
  private async isImageReferencedByOtherMessage(
    imageUrl: string,
    excludeMessageId: Types.ObjectId,
  ): Promise<boolean> {
    const referenceCount = await this.messageModel
      .countDocuments({
        imageUrl,
        _id: { $ne: excludeMessageId },
      } as any)
      .exec();
    return referenceCount > 0;
  }

  /**
   * Process the cleanup job - finds and deletes old chat images.
   * This is the actual worker that processes the queued job.
   */
  async cleanupOldImages(data: ChatJobData): Promise<{
    deletedCount: number;
    referenceRemovedCount: number;
    errors: string[];
  }> {
    const olderThanDays = data.olderThanDays ?? DEFAULT_RETENTION_DAYS;
    this.logger.log(`Starting cleanup of chat images older than ${olderThanDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const errors: string[] = [];
    let deletedCount = 0;
    let referenceRemovedCount = 0;

    try {
      // Find all messages with images older than the cutoff date
      const oldMessages = await this.messageModel
        .find({
          imageUrl: { $exists: true, $nin: [null, ''] },
          createdAt: { $lt: cutoffDate },
        } as any)
        .select('_id imageUrl roomId')
        .lean()
        .exec();

      this.logger.log(`Found ${oldMessages.length} messages with images older than ${olderThanDays} days`);

      for (const message of oldMessages) {
        try {
          const imageUrl = message.imageUrl as string | undefined;
          if (!imageUrl) continue;

          // Check if the image is referenced by any other message
          const isReferenced = await this.isImageReferencedByOtherMessage(
            imageUrl,
            message._id as Types.ObjectId,
          );

          if (isReferenced) {
            // Image is still referenced by another message - only remove the reference
            await this.messageModel
              .updateOne({ _id: message._id }, { $unset: { imageUrl: 1 } })
              .exec();
            referenceRemovedCount++;
            this.logger.debug(`Removed image reference from message ${message._id} (image still referenced by other messages)`);
          } else {
            // Image is not referenced by any other message - safe to delete
            this.uploads.tryDeleteLiveChatByUrl(imageUrl);
            await this.messageModel
              .updateOne({ _id: message._id }, { $unset: { imageUrl: 1 } })
              .exec();
            deletedCount++;
            this.logger.debug(`Deleted image and removed reference from message ${message._id}`);
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup message ${message._id}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Cleanup completed: ${deletedCount} files deleted, ${referenceRemovedCount} references removed, ${errors.length} errors`);
    } catch (error) {
      const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);
    }

    return { deletedCount, referenceRemovedCount, errors };
  }
}
