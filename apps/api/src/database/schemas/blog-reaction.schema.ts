import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BlogReactionType = 'like' | 'dislike';

export type BlogReactionDocument = HydratedDocument<BlogReaction>;

@Schema({ timestamps: true, collection: 'blog_reactions' })
export class BlogReaction {
  @Prop({ type: Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: ['like', 'dislike'], required: true })
  type!: BlogReactionType;
}

export const BlogReactionSchema = SchemaFactory.createForClass(BlogReaction);

BlogReactionSchema.index({ blogId: 1, userId: 1 }, { unique: true });
