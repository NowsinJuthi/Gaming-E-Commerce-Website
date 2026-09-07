import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TelegramSettingsDocument = HydratedDocument<TelegramSettings>;

@Schema({
  timestamps: true,
  collection: 'telegram_settings',
})
export class TelegramSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ default: false })
  enabled!: boolean;

  @Prop({ trim: true, default: '' })
  botToken!: string;

  @Prop({ trim: true, default: '' })
  chatId!: string;

  @Prop({ default: true })
  /** Admin alert on paid / processing / auto-fulfilled — not pending or manual admin complete. */
  notifyOnOrderPlaced!: boolean;

  @Prop({ default: true })
  notifyOnCustomerChat!: boolean;

  updatedAt?: Date;
}

export const TelegramSettingsSchema =
  SchemaFactory.createForClass(TelegramSettings);
