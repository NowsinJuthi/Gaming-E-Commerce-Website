import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationAudience, NotificationType } from '../../common/enums';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    default: NotificationType.System,
  })
  type!: NotificationType;

  @Prop({
    type: String,
    enum: Object.values(NotificationAudience),
    default: NotificationAudience.Customer,
    index: true,
  })
  audience!: NotificationAudience;

  @Prop({ required: true })
  title!: string;

  @Prop()
  body?: string;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop({ default: false, index: true })
  read!: boolean;

  @Prop()
  readAt?: Date;

  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, audience: 1, read: 1 });
