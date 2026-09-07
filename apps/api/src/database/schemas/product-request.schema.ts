import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductRequestDocument = HydratedDocument<ProductRequest>;

@Schema({ timestamps: true, collection: 'product_requests' })
export class ProductRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  productName!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  customerName!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, trim: true, maxlength: 32 })
  mobile!: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  details!: string;

  @Prop({ trim: true, maxlength: 8000 })
  adminReply?: string;

  @Prop()
  repliedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductRequestSchema =
  SchemaFactory.createForClass(ProductRequest);

ProductRequestSchema.index({ createdAt: -1 });
ProductRequestSchema.index({ userId: 1, createdAt: -1 });
