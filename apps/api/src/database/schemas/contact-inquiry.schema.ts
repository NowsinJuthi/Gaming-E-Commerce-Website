import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContactInquiryDocument = HydratedDocument<ContactInquiry>;

export type ContactInquiryStatus = 'new' | 'read' | 'replied' | 'closed';

@Schema({ _id: true })
export class ContactInquiryMessage {
  _id?: Types.ObjectId;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  direction!: 'inbound' | 'outbound';

  @Prop({ required: true, trim: true, maxlength: 10000 })
  body!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  adminId?: Types.ObjectId;

  @Prop({ required: true })
  sentAt!: Date;
}

export const ContactInquiryMessageSchema =
  SchemaFactory.createForClass(ContactInquiryMessage);

@Schema({ timestamps: true, collection: 'contact_inquiries' })
export class ContactInquiry {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  subject!: string;

  @Prop({
    required: true,
    enum: ['new', 'read', 'replied', 'closed'],
    default: 'new',
  })
  status!: ContactInquiryStatus;

  @Prop({ type: [ContactInquiryMessageSchema], default: [] })
  messages!: ContactInquiryMessage[];

  @Prop()
  readAt?: Date;

  @Prop()
  lastMessageAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ContactInquirySchema =
  SchemaFactory.createForClass(ContactInquiry);

ContactInquirySchema.index({ createdAt: -1 });
ContactInquirySchema.index({ status: 1, createdAt: -1 });
ContactInquirySchema.index({ email: 1, createdAt: -1 });
