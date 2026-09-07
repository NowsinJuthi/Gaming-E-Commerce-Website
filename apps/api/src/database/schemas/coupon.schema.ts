import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CouponType } from '../../common/enums';

export type CouponDocument = HydratedDocument<Coupon>;

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ type: String, enum: Object.values(CouponType), required: true })
  type!: CouponType;

  /** Percentage (0-100) when type=percent, absolute amount when type=fixed. */
  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ default: 0, min: 0 })
  minSubtotal!: number;

  @Prop({ min: 0 })
  maxDiscount?: number;

  @Prop()
  startsAt?: Date;

  @Prop()
  expiresAt?: Date;

  /** Global redemption cap (null = unlimited). */
  @Prop({ min: 0 })
  usageLimit?: number;

  @Prop({ default: 0, min: 0 })
  usedCount!: number;

  /** Per-user redemption cap (enforced at checkout). */
  @Prop({ min: 0 })
  perUserLimit?: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Admin listing of active/expiring coupons.
CouponSchema.index({ isActive: 1, expiresAt: 1 });
