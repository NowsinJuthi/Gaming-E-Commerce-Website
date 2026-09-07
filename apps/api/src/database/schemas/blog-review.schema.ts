import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review.enum';

export type BlogReviewDocument = HydratedDocument<BlogReview>;

@Schema({ timestamps: true, collection: 'blog_reviews' })
export class BlogReview {
  @Prop({ type: Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  blogTitle!: string;

  @Prop({ trim: true, lowercase: true, index: true })
  blogSlug!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  customerName!: string;

  @Prop({ trim: true, lowercase: true })
  customerEmail?: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ trim: true, maxlength: 200 })
  title?: string;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  body!: string;

  @Prop({
    type: String,
    enum: Object.values(ReviewStatus),
    default: ReviewStatus.Published,
    index: true,
  })
  status!: ReviewStatus;

  @Prop({ trim: true, maxlength: 2000 })
  adminReply?: string;

  @Prop({ trim: true, maxlength: 120 })
  adminReplyAuthor?: string;

  @Prop()
  adminReplyAt?: Date;
}

export const BlogReviewSchema = SchemaFactory.createForClass(BlogReview);

BlogReviewSchema.index({ blogId: 1, userId: 1 }, { unique: true });
BlogReviewSchema.index({ status: 1, createdAt: -1 });
BlogReviewSchema.index({ rating: 1, status: 1 });
