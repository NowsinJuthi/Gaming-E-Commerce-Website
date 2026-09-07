import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AffiliateCommissionStatus } from '../../common/enums';

export type AffiliateCommissionDocument =
  HydratedDocument<AffiliateCommission>;

/** Commission ledger: one entry per qualifying order, basis for payout reports. */
@Schema({ timestamps: true, collection: 'affiliate_commissions' })
export class AffiliateCommission {
  @Prop({ type: Types.ObjectId, ref: 'Affiliate', required: true, index: true })
  affiliateId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  affiliateUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  referredUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, unique: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  baseAmount!: number;

  @Prop({ required: true })
  rate!: number;

  @Prop({ required: true })
  amount!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({
    type: String,
    enum: Object.values(AffiliateCommissionStatus),
    default: AffiliateCommissionStatus.Pending,
    index: true,
  })
  status!: AffiliateCommissionStatus;

  @Prop({ type: Types.ObjectId, ref: 'WalletTransaction' })
  walletTransactionId?: Types.ObjectId;

  @Prop()
  paidAt?: Date;

  @Prop()
  note?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AffiliateCommissionSchema = SchemaFactory.createForClass(
  AffiliateCommission,
);

AffiliateCommissionSchema.index({ affiliateId: 1, status: 1, createdAt: -1 });
