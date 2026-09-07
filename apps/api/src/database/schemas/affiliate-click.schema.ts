import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AffiliateClickDocument = HydratedDocument<AffiliateClick>;

/** Lightweight click tracking for referral links. Retained 90 days via TTL. */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'affiliate_clicks',
})
export class AffiliateClick {
  @Prop({ type: Types.ObjectId, ref: 'Affiliate', required: true })
  affiliateId!: Types.ObjectId;

  @Prop({ required: true })
  code!: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  landingPath?: string;

  @Prop({ type: Date, default: () => new Date(), expires: '90d' })
  createdAt?: Date;
}

export const AffiliateClickSchema =
  SchemaFactory.createForClass(AffiliateClick);

// Time-bounded per-affiliate click analytics.
AffiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });
