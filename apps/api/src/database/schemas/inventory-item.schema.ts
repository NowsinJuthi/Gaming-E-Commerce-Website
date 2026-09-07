import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { InventoryStatus } from '../../common/enums';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

/** A single deliverable unit (code/credential) for an auto-delivery product. */
@Schema({ timestamps: true, collection: 'inventory_items' })
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  /** Package / variation value id when codes belong to a specific package. */
  @Prop({ index: true, sparse: true })
  variationValueId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', index: true })
  supplierId?: Types.ObjectId;

  /** Encrypted at rest in production; excluded from default reads. */
  @Prop({ required: true, select: false })
  value!: string;

  @Prop({
    type: String,
    enum: Object.values(InventoryStatus),
    default: InventoryStatus.Available,
    index: true,
  })
  status!: InventoryStatus;

  @Prop({ type: Types.ObjectId, ref: 'Order', index: true, sparse: true })
  orderId?: Types.ObjectId;

  @Prop()
  cost?: number;

  @Prop()
  soldAt?: Date;

  createdAt?: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);

InventoryItemSchema.index({ productId: 1, status: 1 });
InventoryItemSchema.index({ productId: 1, variationValueId: 1, status: 1 });
