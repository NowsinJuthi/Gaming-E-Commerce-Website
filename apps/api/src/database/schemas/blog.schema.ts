import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument, Types } from 'mongoose';

import { BlogStatus } from '../../common/enums/blog.enum';



export type BlogDocument = HydratedDocument<Blog>;



@Schema({ timestamps: true, collection: 'blogs' })

export class Blog {

  @Prop({ required: true, trim: true })

  title!: string;



  @Prop({ required: true, unique: true, lowercase: true, trim: true })

  slug!: string;



  @Prop({ trim: true, default: '' })

  excerpt!: string;



  @Prop({ required: true, default: '' })

  content!: string;



  @Prop({ trim: true })

  featuredImage?: string;



  /** Denormalized category name for legacy queries and display. */

  @Prop({ trim: true, index: true })

  category?: string;



  @Prop({ type: Types.ObjectId, ref: 'BlogCategory', index: true })

  categoryId?: Types.ObjectId;



  @Prop({ type: [String], default: [] })

  tags!: string[];



  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })

  authorId!: Types.ObjectId;



  @Prop({

    type: String,

    enum: Object.values(BlogStatus),

    default: BlogStatus.Draft,

    index: true,

  })

  status!: BlogStatus;



  @Prop({ default: 0, min: 0 })

  views!: number;



  @Prop({ default: 0, min: 0 })

  likeCount!: number;



  @Prop({ default: 0, min: 0 })

  dislikeCount!: number;



  @Prop({ trim: true })

  metaTitle?: string;



  @Prop({ trim: true })

  metaDescription?: string;



  @Prop({ trim: true })

  focusKeyword?: string;



  @Prop({ trim: true })

  canonicalUrl?: string;



  @Prop({ trim: true })

  ogImage?: string;



  @Prop({ type: Date, index: true })

  publishedAt?: Date;



  @Prop({ type: Date, index: true })

  submittedAt?: Date;



  @Prop({ type: Types.ObjectId, ref: 'User' })

  reviewedBy?: Types.ObjectId;



  @Prop({ type: Date })

  reviewedAt?: Date;



  @Prop({ trim: true })

  rejectionReason?: string;

}



export const BlogSchema = SchemaFactory.createForClass(Blog);



BlogSchema.index({ status: 1, createdAt: -1 });

BlogSchema.index({ status: 1, publishedAt: -1 });

BlogSchema.index({ status: 1, submittedAt: -1 });

BlogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });


