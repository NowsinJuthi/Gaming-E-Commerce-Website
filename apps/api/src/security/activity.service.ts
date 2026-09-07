import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginatedResult, PaginationDto } from '../common/dto/pagination.dto';
import {
  ActivityLog,
  ActivityLogDocument,
} from '../database/schemas/activity-log.schema';

export interface ActivityInput {
  userId?: string;
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  country?: string;
  cfRay?: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityModel: Model<ActivityLogDocument>,
  ) {}

  /** Fire-and-forget write; never blocks or breaks the request flow. */
  record(input: ActivityInput): void {
    this.activityModel
      .create({
        userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        ip: input.ip,
        userAgent: input.userAgent,
        country: input.country,
        cfRay: input.cfRay,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to record activity: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  async list(
    pagination: PaginationDto,
    userId?: string,
  ): Promise<PaginatedResult<ActivityLog>> {
    const filter = userId ? { userId: new Types.ObjectId(userId) } : {};
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ActivityLog[]>()
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }
}
