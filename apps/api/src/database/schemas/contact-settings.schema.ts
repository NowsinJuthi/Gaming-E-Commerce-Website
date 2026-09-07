import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContactSettingsDocument = HydratedDocument<ContactSettings>;

@Schema({ _id: false })
export class ContactSocialLinkDoc {
  @Prop({ default: '' })
  text!: string;

  @Prop({ default: '' })
  url!: string;
}

@Schema({ _id: false })
export class ContactAddressDoc {
  @Prop({ default: 'Address' })
  label!: string;

  @Prop({ type: [String], default: [] })
  lines!: string[];
}

@Schema({ _id: false })
export class ContactSupportDoc {
  @Prop({ default: 'Support' })
  label!: string;

  @Prop({ type: [String], default: [] })
  phones!: string[];
}

@Schema({ _id: false })
export class ContactEmailDoc {
  @Prop({ default: 'Email' })
  label!: string;

  @Prop({ type: [String], default: [] })
  emails!: string[];
}

@Schema({ _id: false })
export class ContactSocialDoc {
  @Prop({ default: 'Social' })
  label!: string;

  @Prop({ default: '' })
  facebookUrl!: string;

  @Prop({ default: '' })
  youtubeUrl!: string;

  @Prop({ default: '' })
  whatsappUrl!: string;

  @Prop({ type: [{ text: String, url: String }], default: [] })
  links!: ContactSocialLinkDoc[];
}

@Schema({ _id: false })
export class ContactWhatsappCardDoc {
  @Prop({ default: 'Connect Directly' })
  title!: string;

  @Prop({ default: '' })
  description!: string;
}

@Schema({
  timestamps: true,
  collection: 'contact_settings',
})
export class ContactSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ default: 'CONTACT US' })
  heading!: string;

  @Prop({ default: '' })
  subheading!: string;

  @Prop({ default: '' })
  extraText!: string;

  @Prop({ type: ContactAddressDoc, default: () => ({}) })
  address!: ContactAddressDoc;

  @Prop({ type: ContactSupportDoc, default: () => ({}) })
  support!: ContactSupportDoc;

  @Prop({ type: ContactEmailDoc, default: () => ({}) })
  email!: ContactEmailDoc;

  @Prop({ type: ContactSocialDoc, default: () => ({}) })
  social!: ContactSocialDoc;

  /** "Connect Directly" WhatsApp card on the public /contact page. */
  @Prop({ type: ContactWhatsappCardDoc, default: () => ({}) })
  whatsappCard!: ContactWhatsappCardDoc;

  updatedAt?: Date;
}

export const ContactSettingsSchema = SchemaFactory.createForClass(ContactSettings);
