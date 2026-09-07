import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AffiliateStatus } from '../../common/enums';

export type AffiliateDocument = HydratedDocument<Affiliate>;

@Schema({ timestamps: true, collection: 'affiliates' })
export class Affiliate {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({
    type: String,
    enum: Object.values(AffiliateStatus),
    default: AffiliateStatus.Active,
    index: true,
  })
  status!: AffiliateStatus;

  /** Commission as a fraction of the order total (e.g. 0.1 = 10%). */
  @Prop({ default: 0.1, min: 0, max: 1 })
  commissionRate!: number;

  @Prop({ default: 0 })
  clicks!: number;

  @Prop({ default: 0 })
  signups!: number;

  @Prop({ default: 0 })
  conversions!: number;

  /** Lifetime commission already paid out to the wallet. */
  @Prop({ default: 0 })
  totalEarned!: number;

  /** Accrued commission awaiting approval/payout. */
  @Prop({ default: 0 })
  totalPending!: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AffiliateSchema = SchemaFactory.createForClass(Affiliate);
