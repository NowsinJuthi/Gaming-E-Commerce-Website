import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResellerPriceDocument = HydratedDocument<ResellerPrice>;

/** Per-reseller absolute price override for a product (wholesale pricing). */
@Schema({ timestamps: true, collection: 'reseller_prices' })
export class ResellerPrice {
  @Prop({ type: Types.ObjectId, ref: 'Reseller', required: true })
  resellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({ default: true })
  active!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ResellerPriceSchema =
  SchemaFactory.createForClass(ResellerPrice);

ResellerPriceSchema.index({ resellerId: 1, productId: 1 }, { unique: true });
