import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResellerApiKeyDocument = HydratedDocument<ResellerApiKey>;

/**
 * API credential for programmatic reseller access. Only the SHA-256 `hash` is
 * stored; the raw key is shown once at creation. `prefix` is a non-secret
 * display fragment for the dashboard.
 */
@Schema({ timestamps: true, collection: 'reseller_api_keys' })
export class ResellerApiKey {
  @Prop({ type: Types.ObjectId, ref: 'Reseller', required: true, index: true })
  resellerId!: Types.ObjectId;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  prefix!: string;

  @Prop({ required: true, unique: true })
  hash!: string;

  @Prop()
  lastUsedAt?: Date;

  @Prop()
  revokedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ResellerApiKeySchema =
  SchemaFactory.createForClass(ResellerApiKey);
