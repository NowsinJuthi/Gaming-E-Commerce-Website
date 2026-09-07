import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../common/enums';

@Schema({ _id: false })
export class WalletTxnReference {
  /** Originating entity, e.g. 'order', 'payment_intent', 'user'. */
  @Prop()
  type?: string;

  @Prop({ type: Types.ObjectId })
  id?: Types.ObjectId;
}
export const WalletTxnReferenceSchema =
  SchemaFactory.createForClass(WalletTxnReference);

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;

/**
 * Immutable ledger entry. Every balance change writes exactly one row with the
 * before/after snapshot, committed atomically with the wallet update inside a
 * MongoDB transaction.
 */
@Schema({ timestamps: true, collection: 'wallet_transactions' })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WalletTransactionType),
    required: true,
  })
  type!: WalletTransactionType;

  @Prop({
    type: String,
    enum: Object.values(WalletTransactionDirection),
    required: true,
  })
  direction!: WalletTransactionDirection;

  @Prop({
    type: String,
    enum: Object.values(WalletTransactionStatus),
    default: WalletTransactionStatus.Completed,
    index: true,
  })
  status!: WalletTransactionStatus;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({ required: true })
  balanceBefore!: number;

  @Prop({ required: true })
  balanceAfter!: number;

  @Prop({ type: WalletTxnReferenceSchema })
  reference?: WalletTxnReference;

  /** Dedupe key for system-generated credits (e.g. `refund:<orderId>`). */
  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ type: 1, createdAt: -1 });
