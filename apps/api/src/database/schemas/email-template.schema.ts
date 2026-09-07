import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailTemplateDocument = HydratedDocument<EmailTemplate>;

export type EmailTemplateCategory = 'orders' | 'account' | 'system';
export type EmailTemplateRecipient = 'admin' | 'customer';

@Schema({ timestamps: true, collection: 'email_templates' })
export class EmailTemplate {
  /** Stable slug, e.g. `order.new_admin`. */
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, enum: ['orders', 'account', 'system'] })
  category!: EmailTemplateCategory;

  @Prop({ required: true, enum: ['admin', 'customer'] })
  recipient!: EmailTemplateRecipient;

  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ trim: true, default: '' })
  subject!: string;

  @Prop({ trim: true, default: '' })
  heading!: string;

  @Prop({ trim: true, default: '' })
  bodyText!: string;

  @Prop({ trim: true, default: '' })
  buttonLabel!: string;

  @Prop({ trim: true, default: '' })
  buttonUrl!: string;

  @Prop({ default: true })
  enabled!: boolean;

  updatedAt?: Date;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);
