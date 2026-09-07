import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SmsLogDocument = HydratedDocument<SmsLog>;

export enum SmsLogStatus {
  Unmatched = 'unmatched',
  Matched = 'matched',
  Ignored = 'ignored',
}

@Schema({ timestamps: true, collection: 'sms_logs' })
export class SmsLog {
  @Prop({ trim: true })
  sender?: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ trim: true, index: true, sparse: true })
  trxId?: string;

  @Prop({ min: 0 })
  amount?: number;

  @Prop({
    type: String,
    enum: Object.values(SmsLogStatus),
    default: SmsLogStatus.Unmatched,
    index: true,
  })
  status!: SmsLogStatus;

  @Prop({ type: Types.ObjectId, ref: 'PaymentIntent' })
  matchedPaymentIntentId?: Types.ObjectId;

  @Prop({ type: Date })
  smsTimestamp?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SmsLogSchema = SchemaFactory.createForClass(SmsLog);

SmsLogSchema.index({ trxId: 1, status: 1 });
SmsLogSchema.index({ createdAt: -1 });
