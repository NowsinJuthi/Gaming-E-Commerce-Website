import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ResellerStatus, ResellerTier } from '../../common/enums';

export type ResellerDocument = HydratedDocument<Reseller>;

@Schema({ timestamps: true, collection: 'resellers' })
export class Reseller {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  companyName!: string;

  @Prop({
    type: String,
    enum: Object.values(ResellerStatus),
    default: ResellerStatus.Pending,
    index: true,
  })
  status!: ResellerStatus;

  @Prop({
    type: String,
    enum: Object.values(ResellerTier),
    default: ResellerTier.Standard,
  })
  tier!: ResellerTier;

  /** Default discount off retail (basePrice) as a fraction, e.g. 0.15 = 15%. */
  @Prop({ default: 0, min: 0, max: 1 })
  discountRate!: number;

  @Prop({ default: 0 })
  totalOrders!: number;

  @Prop({ default: 0 })
  totalSpent!: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ResellerSchema = SchemaFactory.createForClass(Reseller);
