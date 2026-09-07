import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SupplierCode, SupplierStatus } from '../../common/enums';

export type SupplierDocument = HydratedDocument<Supplier>;

/**
 * Operational settings for an upstream supplier (credentials live in config).
 * `priority` drives failover ordering (lower = tried first).
 */
@Schema({ timestamps: true, collection: 'suppliers' })
export class Supplier {
  @Prop({
    type: String,
    enum: Object.values(SupplierCode),
    required: true,
    unique: true,
  })
  code!: SupplierCode;

  @Prop({ required: true })
  name!: string;

  @Prop({
    type: String,
    enum: Object.values(SupplierStatus),
    default: SupplierStatus.Active,
    index: true,
  })
  status!: SupplierStatus;

  @Prop({ default: 100 })
  priority!: number;

  @Prop({ type: [String], default: [] })
  supportedRegions!: string[];

  @Prop({ type: [String], default: [] })
  supportedCurrencies!: string[];

  @Prop()
  lastBalance?: number;

  @Prop()
  lastBalanceCurrency?: string;

  @Prop()
  lastHealthyAt?: Date;

  @Prop()
  lastError?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);

SupplierSchema.index({ status: 1, priority: 1 });
