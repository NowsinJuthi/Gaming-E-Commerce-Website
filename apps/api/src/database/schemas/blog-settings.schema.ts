import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogSettingsDocument = HydratedDocument<BlogSettings>;

@Schema({ _id: false })
export class BlogPageFeaturesDoc {
  @Prop({ default: true })
  reactionsEnabled!: boolean;

  @Prop({ default: true })
  reviewsEnabled!: boolean;

  @Prop({ default: true })
  viewsEnabled!: boolean;

  @Prop({ default: true })
  authorProfileEnabled!: boolean;

  @Prop({ default: true })
  shareButtonsEnabled!: boolean;

  @Prop({ default: true })
  readingTimeEnabled!: boolean;

  @Prop({ default: true })
  relatedPostsEnabled!: boolean;
}

@Schema({
  timestamps: true,
  collection: 'blog_settings',
})
export class BlogSettings {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: BlogPageFeaturesDoc, default: () => ({}) })
  features!: BlogPageFeaturesDoc;

  updatedAt?: Date;
}

export const BlogSettingsSchema = SchemaFactory.createForClass(BlogSettings);
