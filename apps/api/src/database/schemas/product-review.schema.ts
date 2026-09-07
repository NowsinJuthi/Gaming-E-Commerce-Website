import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review.enum';

export type ProductReviewDocument = HydratedDocument<ProductReview>;

@Schema({ timestamps: true, collection: 'product_reviews' })
export class ProductReview {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  productTitle!: string;

  @Prop({ trim: true, lowercase: true })
  productSlug?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

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
    enum: ReviewStatus,
    default: ReviewStatus.Pending,
    index: true,
  })
  status!: ReviewStatus;

  @Prop({ trim: true, maxlength: 2000 })
  adminReply?: string;

  /** Display name of whoever wrote the store reply (e.g. migrated WP author). */
  @Prop({ trim: true, maxlength: 120 })
  adminReplyAuthor?: string;

  @Prop()
  adminReplyAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  /** WordPress comment_ID for migrated reviews — makes imports re-runnable. */
  @Prop({ index: true, sparse: true })
  legacyWpId?: string;
}

export const ProductReviewSchema = SchemaFactory.createForClass(ProductReview);

ProductReviewSchema.index({ status: 1, createdAt: -1 });
ProductReviewSchema.index({ rating: 1, status: 1 });
