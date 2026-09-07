import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditActorType {
  User = 'user',
  System = 'system',
  Gateway = 'gateway',
}

/**
 * Append-only audit trail. Used by the Payment module to record every
 * lifecycle event (create, verify, webhook, success, failure) for forensics
 * and dispute resolution. Records are retained 1 year via TTL.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({
    type: String,
    enum: Object.values(AuditActorType),
    default: AuditActorType.System,
  })
  actorType!: AuditActorType;

  @Prop({ type: Types.ObjectId })
  actorId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop()
  entityType?: string;

  @Prop({ index: true })
  entityId?: string;

  @Prop()
  gateway?: string;

  @Prop()
  status?: string;

  @Prop()
  ip?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: Date, default: () => new Date(), expires: '365d' })
  createdAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
