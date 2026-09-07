import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MfsProvider } from '../../common/enums';

export type MfsGatewayDocument = HydratedDocument<MfsGateway>;

@Schema({ timestamps: true, collection: 'mfs_gateways' })
export class MfsGateway {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: Object.values(MfsProvider), required: true })
  provider!: MfsProvider;

  @Prop({ required: true, trim: true })
  phoneNumber!: string;

  @Prop({ trim: true })
  qrCodeUrl?: string;

  @Prop({ default: 10, min: 1 })
  minAmount!: number;

  @Prop({ default: 100000, min: 1 })
  maxAmount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ trim: true })
  instructions?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MfsGatewaySchema = SchemaFactory.createForClass(MfsGateway);

MfsGatewaySchema.index({ isActive: 1, sortOrder: 1 });
MfsGatewaySchema.index({ provider: 1 });
