import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WishlistItemDocument = HydratedDocument<WishlistItem>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'wishlist_items',
})
export class WishlistItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Date, default: () => new Date() })
  createdAt?: Date;
}

export const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);

WishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
