import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Seo, SeoSchema } from './seo.schema';

export type BlogCategoryDocument = HydratedDocument<BlogCategory>;

@Schema({ timestamps: true, collection: 'blog_categories' })
export class BlogCategory {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: SeoSchema, default: {} })
  seo?: Seo;
}

export const BlogCategorySchema = SchemaFactory.createForClass(BlogCategory);
