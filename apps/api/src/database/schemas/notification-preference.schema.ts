import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationPreferenceDocument =
  HydratedDocument<NotificationPreference>;

@Schema({ _id: false })
export class ChannelToggles {
  @Prop({ default: true })
  inApp!: boolean;

  @Prop({ default: true })
  email!: boolean;

  @Prop({ default: true })
  push!: boolean;

  @Prop({ default: false })
  telegram!: boolean;
}
export const ChannelTogglesSchema =
  SchemaFactory.createForClass(ChannelToggles);

@Schema({ timestamps: true, collection: 'notification_preferences' })
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: ChannelTogglesSchema, default: {} })
  channels!: ChannelToggles;

  /** Telegram chat id captured after the user starts the bot. */
  @Prop()
  telegramChatId?: string;

  /** Registered push device tokens (e.g. FCM). */
  @Prop({ type: [String], default: [] })
  pushTokens!: string[];

  /** Event keys the user has opted out of entirely. */
  @Prop({ type: [String], default: [] })
  mutedEvents!: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(
  NotificationPreference,
);
