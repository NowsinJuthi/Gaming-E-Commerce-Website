import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentGateway } from '../../common/enums';

export type PaymentSettingsDocument = HydratedDocument<PaymentSettings>;

@Schema({ _id: false })
export class PaymentGatewaySettingsDoc {
  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: false })
  sandbox!: boolean;

  @Prop({ trim: true })
  baseUrl?: string;

  @Prop({ trim: true })
  apiKey?: string;

  @Prop({ trim: true })
  apiSecret?: string;

  @Prop({ trim: true })
  webhookSecret?: string;

  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true })
  password?: string;
}

export const PaymentGatewaySettingsSchema = SchemaFactory.createForClass(
  PaymentGatewaySettingsDoc,
);

@Schema({
  timestamps: true,
  collection: 'payment_settings',
})
export class PaymentSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({
    type: String,
    enum: PaymentGateway,
    default: PaymentGateway.UddoktaPay,
  })
  defaultGateway!: PaymentGateway;

  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  bkash!: PaymentGatewaySettingsDoc;

  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  nagad!: PaymentGatewaySettingsDoc;

  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  rocket!: PaymentGatewaySettingsDoc;

  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  upay!: PaymentGatewaySettingsDoc;

  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  uddoktapay!: PaymentGatewaySettingsDoc;

  /** Reserved — manual MFS uses {@link MfsGateway} collection instead. */
  @Prop({ type: PaymentGatewaySettingsSchema, default: () => ({}) })
  mfs!: PaymentGatewaySettingsDoc;

  updatedAt?: Date;
}

export const PaymentSettingsSchema =
  SchemaFactory.createForClass(PaymentSettings);
