import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SeoSettingsDocument = HydratedDocument<SeoSettings>;

@Schema({ _id: false })
export class GlobalSeoDoc {
  @Prop({ default: 'UniQbd — Digital Goods Marketplace' })
  siteTitle!: string;

  @Prop({
    default:
      "Buy game top-ups, software licenses, gift cards and subscriptions with instant delivery on UniQbd — Bangladesh's trusted digital goods marketplace.",
  })
  siteDescription!: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ default: 'https://uniqbd.com' })
  canonicalDomain!: string;

  /** Default robots directives for indexable pages. */
  @Prop({ default: true })
  robotsIndex!: boolean;

  @Prop({ default: true })
  robotsFollow!: boolean;

  @Prop({ default: '' })
  googleVerification!: string;

  @Prop({ default: '' })
  bingVerification!: string;

  @Prop({ default: '' })
  googleAnalyticsId!: string;

  @Prop({ default: '' })
  gtmId!: string;

  @Prop({ default: '' })
  facebookPixelId!: string;
}

@Schema({ _id: false })
export class HomepageSeoDoc {
  @Prop({ default: '' })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ default: '' })
  ogTitle!: string;

  @Prop({ default: '' })
  ogDescription!: string;

  @Prop({ default: '' })
  ogImage!: string;
}

@Schema({ _id: false })
export class SocialSeoDoc {
  @Prop({ default: '' })
  facebook!: string;

  @Prop({ default: '' })
  instagram!: string;

  @Prop({ default: '' })
  youtube!: string;

  @Prop({ default: '' })
  twitter!: string;

  @Prop({ default: '' })
  discord!: string;
}

@Schema({ _id: false })
export class FaqItemDoc {
  @Prop({ default: '' })
  question!: string;

  @Prop({ default: '' })
  answer!: string;
}

@Schema({ _id: false })
export class SchemaSeoDoc {
  @Prop({ default: true })
  organization!: boolean;

  @Prop({ default: true })
  website!: boolean;

  @Prop({ default: true })
  product!: boolean;

  @Prop({ default: false })
  faq!: boolean;

  @Prop({ type: [FaqItemDoc], default: [] })
  faqItems!: FaqItemDoc[];
}

@Schema({ _id: false })
export class RobotsSeoDoc {
  /** When true the custom `content` is served instead of the generated rules. */
  @Prop({ default: false })
  useCustom!: boolean;

  @Prop({ default: '' })
  content!: string;
}

@Schema({ _id: false })
export class SitemapSeoDoc {
  @Prop()
  lastGeneratedAt?: Date;

  @Prop({ default: 0 })
  urlCount!: number;

  @Prop({ default: 'idle' })
  status!: string;
}

@Schema({ _id: false })
export class StaticPageSeoDoc {
  @Prop({ required: true, trim: true })
  path!: string;

  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ default: '' })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ default: '' })
  ogTitle!: string;

  @Prop({ default: '' })
  ogDescription!: string;

  @Prop({ default: '' })
  ogImage!: string;

  @Prop({ default: false })
  noIndex!: boolean;
}

@Schema({ timestamps: true, collection: 'seo_settings' })
export class SeoSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: GlobalSeoDoc, default: () => ({}) })
  global!: GlobalSeoDoc;

  @Prop({ type: HomepageSeoDoc, default: () => ({}) })
  homepage!: HomepageSeoDoc;

  @Prop({ type: [StaticPageSeoDoc], default: [] })
  staticPages!: StaticPageSeoDoc[];

  @Prop({ type: SocialSeoDoc, default: () => ({}) })
  social!: SocialSeoDoc;

  @Prop({ type: SchemaSeoDoc, default: () => ({}) })
  schema!: SchemaSeoDoc;

  @Prop({ type: RobotsSeoDoc, default: () => ({}) })
  robots!: RobotsSeoDoc;

  @Prop({ type: SitemapSeoDoc, default: () => ({}) })
  sitemap!: SitemapSeoDoc;

  /** Auto-fill product SEO from title/description when fields are empty. */
  @Prop({ default: true })
  autoGenerateProductSeo!: boolean;

  updatedAt?: Date;
}

export const SeoSettingsSchema = SchemaFactory.createForClass(SeoSettings);
