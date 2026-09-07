import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  ResellerOrderSource,
  ResellerOrderStatus,
} from '../../common/enums';

@Schema({ _id: false })
export class ResellerOrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ required: true, min: 0 })
  lineTotal!: number;

  @Prop({ type: [{ code: String }], default: [] })
  deliveredCodes!: Array<{ code: string }>;
}
export const ResellerOrderItemSchema =
  SchemaFactory.createForClass(ResellerOrderItem);

export type ResellerOrderDocument = HydratedDocument<ResellerOrder>;

@Schema({ timestamps: true, collection: 'reseller_orders' })
export class ResellerOrder {
  @Prop({ required: true, unique: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'Reseller', required: true, index: true })
  resellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: [ResellerOrderItemSchema], default: [] })
  items!: ResellerOrderItem[];

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({
    type: String,
    enum: Object.values(ResellerOrderStatus),
    default: ResellerOrderStatus.Pending,
    index: true,
  })
  status!: ResellerOrderStatus;

  @Prop({
    type: String,
    enum: Object.values(ResellerOrderSource),
    default: ResellerOrderSource.Dashboard,
  })
  source!: ResellerOrderSource;

  @Prop({ type: Types.ObjectId, ref: 'WalletTransaction' })
  walletTransactionId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ResellerOrderSchema = SchemaFactory.createForClass(ResellerOrder);

ResellerOrderSchema.index({ resellerId: 1, createdAt: -1 });
