import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Seo, SeoSchema } from './seo.schema';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  parentId?: Types.ObjectId | null;

  /** Materialized ancestor ids (root → parent) for fast subtree queries. */
  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [], index: true })
  path!: Types.ObjectId[];

  @Prop({ default: 0 })
  depth!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;

  @Prop({ type: SeoSchema, default: {} })
  seo?: Seo;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
