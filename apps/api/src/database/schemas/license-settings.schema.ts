import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LicenseSettingsDocument = HydratedDocument<LicenseSettings>;

@Schema({ timestamps: true, collection: 'license_settings' })
export class LicenseSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ trim: true, default: '' })
  licenseKey!: string;

  @Prop({ trim: true, default: '' })
  productId!: string;

  @Prop({ trim: true, default: '' })
  websiteId!: string;

  @Prop({ trim: true, default: '' })
  installationId!: string;

  /** Per-site HMAC secret from license.amarpin.com — never returned to clients. */
  @Prop({ select: false, default: '' })
  siteSecret!: string;

  @Prop({ trim: true, default: 'https://license.amarpin.com/api' })
  apiUrl!: string;

  @Prop({ type: Date, default: null })
  lastValidatedAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastValidAt?: Date | null;

  @Prop({ trim: true, default: '' })
  lastStatus!: string;

  @Prop({ trim: true, default: '' })
  lastCode!: string;

  @Prop({ type: Object, default: {} })
  lastFeatures!: Record<string, boolean>;
}

export const LicenseSettingsSchema =
  SchemaFactory.createForClass(LicenseSettings);
