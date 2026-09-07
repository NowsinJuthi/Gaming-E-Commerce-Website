import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../../common/enums';

export type NotificationDeliveryDocument =
  HydratedDocument<NotificationDelivery>;

/** Per-channel delivery attempt log for auditing/observability. TTL 90 days. */
@Schema({ timestamps: true, collection: 'notification_deliveries' })
export class NotificationDelivery {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  event!: string;

  @Prop({ type: String, enum: Object.values(NotificationChannel), required: true })
  channel!: NotificationChannel;

  @Prop({
    type: String,
    enum: Object.values(NotificationDeliveryStatus),
    default: NotificationDeliveryStatus.Pending,
    index: true,
  })
  status!: NotificationDeliveryStatus;

  @Prop()
  recipient?: string;

  @Prop()
  title?: string;

  @Prop({ index: true })
  orderNumber?: string;

  @Prop()
  providerRef?: string;

  @Prop()
  error?: string;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ type: Date, default: () => new Date(), expires: '90d' })
  createdAt?: Date;

  updatedAt?: Date;
}

export const NotificationDeliverySchema = SchemaFactory.createForClass(
  NotificationDelivery,
);

NotificationDeliverySchema.index({ userId: 1, createdAt: -1 });
