import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WebsiteSettingsDocument = HydratedDocument<WebsiteSettings>;

@Schema({ _id: false })
export class WebsiteGuideStepDoc {
  @Prop({ default: '01' })
  number!: string;

  @Prop({ default: '' })
  title!: string;

  @Prop({ default: '' })
  body!: string;
}

@Schema({ _id: false })
export class WebsiteIntroSectionDoc {
  @Prop({ default: 'Best Website Development Company in Bangladesh' })
  title!: string;

  @Prop({ type: [String], default: [] })
  paragraphs!: string[];
}

@Schema({ _id: false })
export class WebsiteGuideSectionDoc {
  @Prop({ default: "What's first up for your business?" })
  title!: string;

  @Prop({ type: [WebsiteGuideStepDoc], default: [] })
  steps!: WebsiteGuideStepDoc[];
}

@Schema({ _id: false })
export class WebsitePricingPackageDoc {
  @Prop({ required: true, default: '' })
  id!: string;

  @Prop({ default: '' })
  name!: string;

  @Prop({ default: '' })
  subtitle!: string;

  @Prop({ default: 0 })
  price!: number;

  @Prop({ default: 'BDT' })
  currency!: string;

  @Prop({ default: '' })
  priceLabel!: string;

  @Prop({ default: '' })
  badge!: string;

  @Prop({ default: false })
  highlighted!: boolean;

  @Prop({ default: 'All features' })
  featuresHeading!: string;

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ default: 'Get Started' })
  ctaLabel!: string;

  @Prop({ default: '/support' })
  ctaHref!: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

@Schema({
  timestamps: true,
  collection: 'website_settings',
})
export class WebsiteSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ default: 'Website Development' })
  heroEyebrow!: string;

  @Prop({ default: 'Website Development Package & Price' })
  heading!: string;

  @Prop({ default: 'Best Web Development Company in Bangladesh' })
  subheading!: string;

  @Prop({ default: 'বিশেষ অফার:' })
  offerTitle!: string;

  @Prop({
    default:
      'সীমিত সময়ের অফার — যেকোনো ওয়েবসাইট প্যাকেজে ১০টি অতিরিক্ত পেজ মাত্র ৳৫,০০০-এ! আরও বেশি কন্টেন্ট ও ফিচার নিয়ে আপনার ওয়েবসাইট আরও সম্পূর্ণ করুন।',
  })
  offerText!: string;

  @Prop({ default: '' })
  heroNoteTitle!: string;

  @Prop({
    default: 'কাস্টমারের রিকুয়ারমেন্ট অনুযায়ী ওয়েবসাইট বানানো হয়।',
  })
  heroNoteText!: string;

  @Prop({
    default:
      'আপনার ব্যবসার ধরন, কন্টেন্ট ও ফিচার অনুযায়ী প্রতিটি ওয়েবসাইট আলাদাভাবে তৈরি করা হয়।',
  })
  heroNoteSubtext!: string;

  @Prop({ type: WebsiteIntroSectionDoc, default: () => ({}) })
  introSection!: WebsiteIntroSectionDoc;

  @Prop({ type: WebsiteGuideSectionDoc, default: () => ({}) })
  guideSection!: WebsiteGuideSectionDoc;

  @Prop({ type: [WebsitePricingPackageDoc], default: [] })
  packages!: WebsitePricingPackageDoc[];

  updatedAt?: Date;
}

export const WebsiteSettingsSchema =
  SchemaFactory.createForClass(WebsiteSettings);
