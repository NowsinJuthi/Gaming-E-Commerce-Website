import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Seo {
  @Prop()
  metaTitle?: string;

  @Prop()
  metaDescription?: string;

  @Prop({ type: [String], default: [] })
  keywords?: string[];

  @Prop()
  canonicalUrl?: string;

  @Prop()
  ogImage?: string;

  @Prop()
  ogTitle?: string;

  @Prop()
  ogDescription?: string;

  @Prop()
  twitterTitle?: string;

  @Prop()
  twitterDescription?: string;

  @Prop()
  twitterImage?: string;

  /** Per-entity robots override, e.g. "noindex,follow". Empty = inherit defaults. */
  @Prop()
  metaRobots?: string;
}

export const SeoSchema = SchemaFactory.createForClass(Seo);
