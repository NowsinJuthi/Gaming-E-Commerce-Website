import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SupplierCode, SupplierOrderStatus } from '../../common/enums';

@Schema({ _id: false })
export class SupplierDeliveredCode {
  @Prop({ required: true })
  code!: string;

  @Prop()
  serial?: string;

  @Prop()
  pin?: string;
}
export const SupplierDeliveredCodeSchema = SchemaFactory.createForClass(
  SupplierDeliveredCode,
);

export type SupplierOrderDocument = HydratedDocument<SupplierOrder>;

/**
 * One procurement attempt against a supplier. Failover writes one row per
 * attempt, giving a full audit of which suppliers were tried and why each
 * failed before one succeeded.
 */
@Schema({ timestamps: true, collection: 'supplier_orders' })
export class SupplierOrder {
  /** Our marketplace order this procurement is for (when applicable). */
  @Prop({ type: Types.ObjectId, ref: 'Order', index: true })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(SupplierCode),
    required: true,
    index: true,
  })
  supplierCode!: SupplierCode;

  @Prop({ required: true })
  externalProductId!: string;

  @Prop()
  externalOrderId?: string;

  @Prop({ required: true, default: 1 })
  quantity!: number;

  @Prop({
    type: String,
    enum: Object.values(SupplierOrderStatus),
    default: SupplierOrderStatus.Pending,
    index: true,
  })
  status!: SupplierOrderStatus;

  @Prop()
  cost?: number;

  @Prop()
  currency?: string;

  @Prop({ type: [SupplierDeliveredCodeSchema], default: [] })
  codes!: SupplierDeliveredCode[];

  /** 1-based position in the failover chain. */
  @Prop({ default: 1 })
  attempt!: number;

  @Prop()
  error?: string;

  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SupplierOrderSchema = SchemaFactory.createForClass(SupplierOrder);

SupplierOrderSchema.index({ orderId: 1, createdAt: -1 });
SupplierOrderSchema.index({ supplierCode: 1, status: 1, createdAt: -1 });
