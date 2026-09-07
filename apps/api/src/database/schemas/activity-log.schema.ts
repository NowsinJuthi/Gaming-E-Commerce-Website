import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

/**
 * Lightweight per-request activity trail (who did what, from where). Distinct
 * from the security audit log: this captures user-facing traffic for analytics
 * and abuse investigation. Retained by TTL (see `expires`).
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'activity_logs',
})
export class ActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  method!: string;

  @Prop({ required: true })
  path!: string;

  @Prop()
  statusCode?: number;

  @Prop()
  durationMs?: number;

  @Prop({ index: true })
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  country?: string;

  /** Cloudflare ray id when present, useful for cross-referencing edge logs. */
  @Prop()
  cfRay?: string;

  @Prop({ type: Date, default: () => new Date(), expires: '60d' })
  createdAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });
