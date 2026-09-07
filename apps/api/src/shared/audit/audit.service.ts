import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  AuditActorType,
  AuditLog,
  AuditLogDocument,
} from '../../database/schemas/audit-log.schema';

export interface AuditRecordInput {
  action: string;
  actorType?: AuditActorType;
  actorId?: string | Types.ObjectId;
  entityType?: string;
  entityId?: string;
  gateway?: string;
  status?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Writes to the append-only audit trail. Recording must never break the
 * primary flow, so failures are logged and swallowed.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.auditModel.create({
        action: input.action,
        actorType: input.actorType ?? AuditActorType.System,
        actorId: input.actorId
          ? new Types.ObjectId(input.actorId)
          : undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        gateway: input.gateway,
        status: input.status,
        ip: input.ip,
        metadata: input.metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${input.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(
    pagination: PaginationDto,
    query: AuditQuery = {},
  ): Promise<PaginatedResult<AuditLog>> {
    const filter: FilterQuery<AuditLogDocument> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;

    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<AuditLog[]>()
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }
}
