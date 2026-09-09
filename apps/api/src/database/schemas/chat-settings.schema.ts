import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatSettingsDocument = HydratedDocument<ChatSettings>;

@Schema({ _id: false })
export class ChatQuickReplyDoc {
  @Prop({ required: true, trim: true })
  id!: string;

  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ trim: true, default: '' })
  category!: string;

  @Prop({ trim: true, default: '' })
  body!: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

@Schema({
  timestamps: true,
  collection: 'chat_settings',
})
export class ChatSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: [ChatQuickReplyDoc], default: [] })
  quickReplies!: ChatQuickReplyDoc[];

  @Prop({ default: false })
  welcomeAutoReplyEnabled!: boolean;

  @Prop({
    trim: true,
    default:
      'Welcome to UniQbd Support! Thanks for reaching out. Our support team will reply as soon as possible.',
  })
  welcomeAutoReplyMessage!: string;

  updatedAt?: Date;
}

export const ChatSettingsSchema = SchemaFactory.createForClass(ChatSettings);
