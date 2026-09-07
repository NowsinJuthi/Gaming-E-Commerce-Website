import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SupplierCode, SupplierStockStatus } from '../../common/enums';

export type SupplierProductDocument = HydratedDocument<SupplierProduct>;

/**
 * Maps one of our catalog products (by id and/or SKU) to a supplier's external
 * product. Multiple offerings per product enable cost-based failover routing.
 */
@Schema({ timestamps: true, collection: 'supplier_products' })
export class SupplierProduct {
  @Prop({
    type: String,
    enum: Object.values(SupplierCode),
    required: true,
    index: true,
  })
  supplierCode!: SupplierCode;

  @Prop({ type: Types.ObjectId, ref: 'Product', index: true })
  productId?: Types.ObjectId;

  @Prop({ index: true })
  sku?: string;

  @Prop({ required: true })
  externalProductId!: string;

  @Prop({ required: true, min: 0 })
  cost!: number;

  @Prop({ default: DEFAULT_CURRENCY })
  currency!: string;

  @Prop({ index: true })
  region?: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({
    type: String,
    enum: Object.values(SupplierStockStatus),
    default: SupplierStockStatus.Unknown,
  })
  stockStatus!: SupplierStockStatus;

  /** Optional per-offering override of the supplier-level priority. */
  @Prop()
  priority?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SupplierProductSchema =
  SchemaFactory.createForClass(SupplierProduct);

SupplierProductSchema.index({ productId: 1, enabled: 1 });
SupplierProductSchema.index(
  { supplierCode: 1, externalProductId: 1 },
  { unique: true },
);
