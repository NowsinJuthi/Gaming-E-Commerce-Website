import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AffiliateReferralDocument = HydratedDocument<AffiliateReferral>;

/**
 * Binds a referred user to the affiliate who introduced them. Unique on the
 * referred user — first-touch attribution, one affiliate per user.
 */
@Schema({ timestamps: true, collection: 'affiliate_referrals' })
export class AffiliateReferral {
  @Prop({ type: Types.ObjectId, ref: 'Affiliate', required: true, index: true })
  affiliateId!: Types.ObjectId;

  @Prop({ required: true })
  code!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  referredUserId!: Types.ObjectId;

  @Prop()
  convertedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  firstOrderId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AffiliateReferralSchema =
  SchemaFactory.createForClass(AffiliateReferral);
