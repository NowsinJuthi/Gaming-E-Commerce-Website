import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MfsProvider } from '../../common/enums';

export type MfsSmsFormatSettingsDocument =
  HydratedDocument<MfsSmsFormatSettings>;

@Schema({ _id: false })
export class MfsSmsProviderFormatDoc {
  @Prop({ required: true, enum: Object.values(MfsProvider) })
  provider!: MfsProvider;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  priority!: number;

  @Prop({ type: [String], default: [] })
  detectKeywords!: string[];

  @Prop({ type: [String], default: [] })
  detectPatterns!: string[];

  @Prop({ type: [String], default: [] })
  trxIdPatterns!: string[];

  @Prop({ type: [String], default: [] })
  amountPatterns!: string[];

  @Prop({ default: '' })
  sampleSms!: string;
}

export const MfsSmsProviderFormatSchema = SchemaFactory.createForClass(
  MfsSmsProviderFormatDoc,
);

@Schema({
  timestamps: true,
  collection: 'mfs_sms_format_settings',
})
export class MfsSmsFormatSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: [MfsSmsProviderFormatSchema], default: [] })
  providers!: MfsSmsProviderFormatDoc[];

  updatedAt?: Date;
}

export const MfsSmsFormatSettingsSchema = SchemaFactory.createForClass(
  MfsSmsFormatSettings,
);
