import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PaymentGateway,
  PaymentIntentStatus,
  PaymentPurpose,
} from '../../common/enums';

export type PaymentIntentDocument = HydratedDocument<PaymentIntent>;

@Schema({ timestamps: true, collection: 'payment_intents' })
export class PaymentIntent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(PaymentGateway), required: true })
  gateway!: PaymentGateway;

  @Prop({
    type: String,
    enum: Object.values(PaymentPurpose),
    required: true,
  })
  purpose!: PaymentPurpose;

  /** Set when purpose is `order`. */
  @Prop({ type: Types.ObjectId, ref: 'Order', index: true })
  orderId?: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentIntentStatus),
    default: PaymentIntentStatus.Created,
    index: true,
  })
  status!: PaymentIntentStatus;

  /** Reference assigned by the gateway (transaction/invoice id). */
  @Prop({ index: true })
  gatewayRef?: string;

  /** Hosted checkout URL the shopper is redirected to. */
  @Prop()
  checkoutUrl?: string;

  /** Caller-supplied idempotency key to dedupe retried create requests. */
  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  /** Number of verification poll attempts performed by the retry worker. */
  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  lastError?: string;

  @Prop()
  paidAt?: Date;

  /**
   * TTL anchor: abandoned intents are removed once this passes. Cleared on
   * success so settled payments are retained. `expires: 0` deletes the doc
   * when the stored date is reached.
   */
  @Prop({ type: Date, expires: 0 })
  expiresAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  /** Selected manual MFS gateway (bKash/Nagad number config). */
  @Prop({ type: Types.ObjectId, ref: 'MfsGateway', index: true })
  mfsGatewayId?: Types.ObjectId;

  /** Customer-submitted mobile wallet transaction ID. */
  @Prop({ trim: true, index: true, sparse: true })
  submittedTrxId?: string;

  @Prop({ trim: true })
  verificationSource?: 'sms' | 'trx_submit' | 'admin';

  createdAt?: Date;
  updatedAt?: Date;
}

export const PaymentIntentSchema = SchemaFactory.createForClass(PaymentIntent);

PaymentIntentSchema.index({ gateway: 1, gatewayRef: 1 });
PaymentIntentSchema.index({ userId: 1, createdAt: -1 });
PaymentIntentSchema.index({ status: 1, createdAt: -1 });
